import { prisma } from "../../db/prisma";
import { uniwareClient } from "./client";
import { workflowService } from "../../services/workflow.service";

export interface SyncRunResult {
  syncRunId: string;
  status: "SUCCESS" | "FAILED";
  recordsFetched: number;
  recordsUpserted: number;
  recordsFailed: number;
  errorMessage?: string;
}

export class UniwareSyncService {
  /**
   * Run synchronization pass against Uniware
   */
  public async executeSync(syncType: "INITIAL" | "INCREMENTAL_POLL" | "MANUAL_TRIGGER"): Promise<SyncRunResult> {
    const startedAt = new Date();
    const syncRun = await prisma.integrationSyncRun.create({
      data: {
        provider: "UNIWARE",
        syncType,
        startedAt,
        status: "RUNNING",
      },
    });

    let recordsFetched = 0;
    let recordsUpserted = 0;
    let recordsFailed = 0;

    try {
      // 1. Fetch current checkpoint
      const checkpoint = await prisma.integrationCheckpoint.findUnique({
        where: { provider: "UNIWARE" },
      });

      const pageSize = parseInt(process.env.UNIWARE_PAGE_SIZE || "10", 10);
      const lookbackDays = parseInt(process.env.UNIWARE_INITIAL_LOOKBACK_DAYS || "7", 10);

      const toDate = new Date();
      let fromDate: Date;

      if (!checkpoint?.lastCheckpointValue || syncType === "INITIAL") {
        fromDate = new Date(toDate.getTime() - lookbackDays * 24 * 3600 * 1000);
      } else {
        // Use overlapping 15-minute window before the last checkpoint to avoid boundary misses
        const lastCheckpointDate = new Date(checkpoint.lastCheckpointValue);
        fromDate = new Date(lastCheckpointDate.getTime() - 15 * 60 * 1000);
      }

      // Format ISO strings without milliseconds as expected by Uniware (YYYY-MM-DDTHH:mm:ss)
      const formatUniwareDate = (d: Date) => d.toISOString().split(".")[0];
      const fromDateStr = formatUniwareDate(fromDate);
      const toDateStr = formatUniwareDate(toDate);

      let displayStart = 0;
      let hasMore = true;

      while (hasMore) {
        const searchResult = await uniwareClient.searchOrders({
          dateType: checkpoint?.lastCheckpointValue ? "UPDATED" : "CREATED",
          fromDate: fromDateStr,
          toDate: toDateStr,
          searchOptions: {
            displayStart,
            displayLength: pageSize,
            getCount: true,
          },
        });

        if (!searchResult.successful) {
          const err = searchResult.errors?.[0]?.message || "Uniware search API reported unsuccessful";
          throw new Error(err);
        }

        const elements = searchResult.elements || [];
        recordsFetched += elements.length;

        for (const item of elements) {
          try {
            await this.processUniwareOrder(item.code);
            recordsUpserted++;
          } catch (itemErr) {
            console.error(`Failed to process Uniware order #${item.code}:`, itemErr);
            recordsFailed++;
          }
        }

        if (elements.length < pageSize) {
          hasMore = false;
        } else {
          displayStart += pageSize;
        }
      }

      // 2. Advance checkpoint safely now that all pages in window succeeded
      await prisma.integrationCheckpoint.upsert({
        where: { provider: "UNIWARE" },
        update: {
          lastCheckpointValue: toDate.toISOString(),
          lastRunAt: startedAt,
          lastSuccessAt: new Date(),
          status: "SUCCESS",
          failureCount: 0,
          lastError: null,
        },
        create: {
          provider: "UNIWARE",
          lastCheckpointValue: toDate.toISOString(),
          lastRunAt: startedAt,
          lastSuccessAt: new Date(),
          status: "SUCCESS",
        },
      });

      // 3. Complete SyncRun
      await prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          completedAt: new Date(),
          status: "SUCCESS",
          recordsFetched,
          recordsUpserted,
          recordsFailed,
        },
      });

      return {
        syncRunId: syncRun.id,
        status: "SUCCESS",
        recordsFetched,
        recordsUpserted,
        recordsFailed,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[UniwareSync] Sync run failed:", errorMessage);

      await prisma.integrationCheckpoint.upsert({
        where: { provider: "UNIWARE" },
        update: {
          lastRunAt: startedAt,
          status: "FAILED",
          failureCount: { increment: 1 },
          lastError: errorMessage,
        },
        create: {
          provider: "UNIWARE",
          lastRunAt: startedAt,
          status: "FAILED",
          failureCount: 1,
          lastError: errorMessage,
        },
      });

      await prisma.integrationSyncRun.update({
        where: { id: syncRun.id },
        data: {
          completedAt: new Date(),
          status: "FAILED",
          recordsFetched,
          recordsUpserted,
          recordsFailed,
          errorMessage,
        },
      });

      return {
        syncRunId: syncRun.id,
        status: "FAILED",
        recordsFetched,
        recordsUpserted,
        recordsFailed,
        errorMessage,
      };
    }
  }

  /**
   * Process a single order by fetching complete details and upserting into database
   */
  public async processUniwareOrder(orderCode: string) {
    const details = await uniwareClient.getOrderDetails(orderCode);
    const dto = details.saleOrderDTO;
    if (!dto) throw new Error(`Empty saleOrderDTO returned for code ${orderCode}`);

    const shippingAddr = dto.addresses?.find((a) => a.type === "SHIPPING") || dto.addresses?.[0];
    const country = shippingAddr?.country?.toUpperCase() || "IN";
    const isExport = country !== "IN";

    // Upsert Order
    const existingOrder = await prisma.order.findUnique({
      where: { uniwareOrderCode: dto.code },
    });

    const order = await prisma.order.upsert({
      where: { uniwareOrderCode: dto.code },
      update: {
        displayOrderCode: dto.displayOrderCode,
        channel: dto.channel || "UNIWARE",
        source: dto.source || "UNIWARE",
        uniwareStatus: dto.status,
        packagingType: isExport ? "EXPORT" : "DOMESTIC",
        destinationCountry: country,
        shippingAddressCity: shippingAddr?.city,
        shippingAddressState: shippingAddr?.state,
        currency: dto.currency || "INR",
        totalAmount: dto.totalPrice || 0,
        isCod: !!dto.cashOnDelivery,
        displayOrderDateTime: dto.created ? new Date(dto.created) : undefined,
        fulfillmentDeadline: dto.fulfillmentTat ? new Date(dto.fulfillmentTat) : undefined,
      },
      create: {
        uniwareOrderCode: dto.code,
        displayOrderCode: dto.displayOrderCode,
        channel: dto.channel || "UNIWARE",
        source: dto.source || "UNIWARE",
        uniwareStatus: dto.status,
        internalStage: "RAW_MATERIAL",
        packagingType: isExport ? "EXPORT" : "DOMESTIC",
        destinationCountry: country,
        shippingAddressCity: shippingAddr?.city,
        shippingAddressState: shippingAddr?.state,
        currency: dto.currency || "INR",
        totalAmount: dto.totalPrice || 0,
        isCod: !!dto.cashOnDelivery,
        displayOrderDateTime: dto.created ? new Date(dto.created) : undefined,
        fulfillmentDeadline: dto.fulfillmentTat ? new Date(dto.fulfillmentTat) : undefined,
      },
    });

    // Process line items
    if (dto.saleOrderItems) {
      for (const item of dto.saleOrderItems) {
        // Find matching SKU by itemSKU or fallback
        let sku = await prisma.sKU.findUnique({
          where: { code: item.itemSKU },
        });

        if (!sku) {
          // Auto create SKU placeholder if first time seen
          sku = await prisma.sKU.create({
            data: {
              code: item.itemSKU,
              name: item.itemName || item.itemSKU,
              unitPrice: item.sellingPrice || 0,
            },
          });
        }

        const existingLine = await prisma.orderLine.findFirst({
          where: { orderId: order.id, skuId: sku.id },
        });

        if (!existingLine) {
          await prisma.orderLine.create({
            data: {
              orderId: order.id,
              skuId: sku.id,
              uniwareItemCode: item.code,
              quantity: item.quantity || 1,
              unitPrice: item.sellingPrice || item.totalPrice || 0,
              status: item.itemStatus || dto.status,
            },
          });
        }
      }
    }

    // If order was newly created, trigger allocation workflow
    if (!existingOrder) {
      await workflowService.allocateOrder(order.id);
    }
  }
}

export const uniwareSyncService = new UniwareSyncService();
