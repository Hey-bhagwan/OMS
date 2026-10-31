import { prisma } from "../../db/prisma";
import { uniwareClient } from "./client";
import { workflowService } from "../../services/workflow.service";
import { SyncStatus } from "@prisma/client";

export interface SyncOrderSummary {
  orderCode: string;
  displayOrderCode?: string | null;
  status: string;
  internalStage: string;
  city?: string;
  itemsCount: number;
  skuCode?: string;
}

export interface SyncRunResult {
  syncRunId: string;
  status: "SUCCESS" | "FAILED";
  recordsFetched: number;
  recordsUpserted: number;
  recordsFailed: number;
  errorMessage?: string;
  ordersSummary?: SyncOrderSummary[];
}

type InternalStage =
  | "DELIVERY"
  | "CANCELLED"
  | "PRODUCTION"
  | "RAW_MATERIAL";

type SyncDateType = "CREATED" | "UPDATED";

export class UniwareSyncService {
  /**
   * Run a Uniware sync.
   *
   * Manual CREATED sync:
   *   executeSync("MANUAL_TRIGGER", "CREATED")
   *
   * Manual UPDATED sync:
   *   executeSync("MANUAL_TRIGGER", "UPDATED")
   *
   * CREATED sync also checks whether orders already exist in our database.
   * Existing orders are updated rather than duplicated.
   */
  public async executeSync(
    syncType: "INITIAL" | "INCREMENTAL_POLL" | "MANUAL_TRIGGER",
    dateTypeOverride?: SyncDateType,
    dateRangeOverride?: { fromDate?: string | Date; toDate?: string | Date },
  ): Promise<SyncRunResult> {
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
    const ordersSummary: SyncOrderSummary[] = [];

    try {
      const checkpoint =
        await prisma.integrationCheckpoint.findUnique({
          where: { provider: "UNIWARE" },
        });

      const configuredPageSize = Number.parseInt(
        process.env.UNIWARE_PAGE_SIZE || "50",
        10,
      );

      const pageSize =
        Number.isFinite(configuredPageSize) && configuredPageSize > 0
          ? configuredPageSize
          : 50;

      const configuredLookback = Number.parseInt(
        process.env.UNIWARE_INITIAL_LOOKBACK_DAYS || "60",
        10,
      );

      const lookbackDays =
        Number.isFinite(configuredLookback) && configuredLookback > 0
          ? configuredLookback
          : 60;

      const dateType: SyncDateType =
        dateTypeOverride ||
        (syncType === "INITIAL" ? "CREATED" : "UPDATED");

      let toDate: Date;
      if (dateRangeOverride?.toDate) {
        toDate = new Date(dateRangeOverride.toDate);
        if (Number.isNaN(toDate.getTime())) {
          throw new Error("Invalid toDate provided");
        }
      } else {
        toDate = new Date();
      }

      let fromDate: Date;

      if (dateRangeOverride?.fromDate) {
        fromDate = new Date(dateRangeOverride.fromDate);
        if (Number.isNaN(fromDate.getTime())) {
          throw new Error("Invalid fromDate provided");
        }
      } else if (checkpoint?.lastSuccessAt || checkpoint?.lastRunAt) {
        // If previous sync exists, sync from last sync timestamp (with 15 min buffer) up to now
        const lastSyncTime = new Date(
          (checkpoint.lastSuccessAt || checkpoint.lastRunAt)!,
        );
        fromDate = new Date(lastSyncTime.getTime() - 15 * 60 * 1000);
      } else if (process.env.UNIWARE_FROM_DATE) {
        const configuredDate = new Date(
          process.env.UNIWARE_FROM_DATE,
        );

        if (Number.isNaN(configuredDate.getTime())) {
          throw new Error(
            "UNIWARE_FROM_DATE is not a valid date",
          );
        }

        fromDate = configuredDate;
      } else if (
        dateType === "CREATED" ||
        !checkpoint?.lastCheckpointValue
      ) {
        // First sync fallback lookback window
        fromDate = new Date(
          toDate.getTime() -
            lookbackDays * 24 * 60 * 60 * 1000,
        );
      } else {
        // Re-read a 15-minute overlap to avoid missing updates
        // around the previous checkpoint.
        const lastCheckpointDate = new Date(
          checkpoint.lastCheckpointValue,
        );

        if (Number.isNaN(lastCheckpointDate.getTime())) {
          fromDate = new Date(
            toDate.getTime() -
              lookbackDays * 24 * 60 * 60 * 1000,
          );
        } else {
          fromDate = new Date(
            lastCheckpointDate.getTime() - 15 * 60 * 1000,
          );
        }
      }

      // Uniware expects YYYY-MM-DDTHH:mm:ss.
      // No milliseconds or timezone suffix.
      const formatUniwareDate = (date: Date): string => {
        const pad = (value: number) =>
          String(value).padStart(2, "0");

        return (
          `${date.getFullYear()}-` +
          `${pad(date.getMonth() + 1)}-` +
          `${pad(date.getDate())}T` +
          `${pad(date.getHours())}:` +
          `${pad(date.getMinutes())}:` +
          `${pad(date.getSeconds())}`
        );
      };

      const fromDateStr = formatUniwareDate(fromDate);
      const toDateStr = formatUniwareDate(toDate);

      let displayStart = 0;
      let hasMore = true;

      while (hasMore) {
        const searchResult = await uniwareClient.searchOrders({
          dateType,
          fromDate: fromDateStr,
          toDate: toDateStr,
          searchOptions: {
            displayStart,
            displayLength: pageSize,
            getCount: true,
          },
        });

        if (!searchResult.successful) {
          const message =
            searchResult.errors?.[0]?.message ||
            "Uniware search API reported unsuccessful";

          throw new Error(message);
        }

        const elements = searchResult.elements || [];

        recordsFetched += elements.length;

        // Persist progress of fetched count
        await prisma.integrationSyncRun.update({
          where: { id: syncRun.id },
          data: { recordsFetched },
        }).catch(() => {});

        let processedInBatch = 0;
        for (const item of elements) {
          try {
            if (!item?.code) {
              throw new Error(
                "Uniware search result did not contain an order code",
              );
            }

            const processedOrder = await this.processUniwareOrder(item.code, item);
            recordsUpserted++;
            if (processedOrder) {
              ordersSummary.push({
                orderCode: processedOrder.uniwareOrderCode,
                displayOrderCode: processedOrder.displayOrderCode,
                status: processedOrder.uniwareStatus,
                internalStage: processedOrder.internalStage,
                city: processedOrder.shippingAddressCity || "-",
                itemsCount: 1,
              });
            }
          } catch (itemErr: unknown) {
            console.error(
              `Failed to process Uniware order #${item?.code || "UNKNOWN"}:`,
              itemErr,
            );

            recordsFailed++;
          }

          processedInBatch++;
          if (processedInBatch % 5 === 0 || processedInBatch === elements.length) {
            await prisma.integrationSyncRun.update({
              where: { id: syncRun.id },
              data: { recordsUpserted, recordsFailed },
            }).catch(() => {});
          }
        }

        hasMore = elements.length === pageSize;

        if (hasMore) {
          displayStart += pageSize;
        }
      }

      const checkpointStatus: SyncStatus =
        recordsFailed === 0 ? "SUCCESS" : "FAILED";

      const checkpointData = {
        lastRunAt: startedAt,
        status: checkpointStatus,
        lastSuccessAt:
          recordsFailed === 0 ? new Date() : undefined,
        failureCount:
          recordsFailed === 0
            ? 0
            : { increment: 1 },
        lastError:
          recordsFailed === 0
            ? null
            : `${recordsFailed} order(s) failed during processing`,
      };

      await prisma.integrationCheckpoint.upsert({
        where: { provider: "UNIWARE" },

        update: {
          ...checkpointData,

          // A CREATED sync must not advance the UPDATED checkpoint.
          ...(dateType === "UPDATED"
            ? { lastCheckpointValue: toDate.toISOString() }
            : {}),
        },

        create: {
          provider: "UNIWARE",
          lastCheckpointValue: toDate.toISOString(),
          lastRunAt: startedAt,
          lastSuccessAt:
            recordsFailed === 0 ? new Date() : undefined,
          status: recordsFailed === 0 ? "SUCCESS" : "FAILED",
          failureCount: recordsFailed,
          lastError:
            recordsFailed === 0
              ? null
              : `${recordsFailed} order(s) failed during processing`,
        },
      });

      await prisma.integrationSyncRun.update({
        where: { id: syncRun.id },

        data: {
          completedAt: new Date(),
          status: recordsFailed === 0 ? "SUCCESS" : "FAILED",
          recordsFetched,
          recordsUpserted,
          recordsFailed,
          ...(recordsFailed > 0
            ? {
                errorMessage:
                  `${recordsFailed} order(s) failed during processing`,
              }
            : {}),
        },
      });

      return {
        syncRunId: syncRun.id,
        status: recordsFailed === 0 ? "SUCCESS" : "FAILED",
        recordsFetched,
        recordsUpserted,
        recordsFailed,
        ordersSummary,
        ...(recordsFailed > 0
          ? {
              errorMessage:
                `${recordsFailed} order(s) failed during processing`,
            }
          : {}),
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      console.error(
        "[UniwareSync] Sync run failed:",
        errorMessage,
      );

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
   * Fetch order details and safely insert or update the order.
   *
   * The database's uniwareOrderCode is the unique identifier.
   * This makes CREATED and UPDATED syncs safe to repeat.
   */
  public async processUniwareOrder(
    orderCode: string,
    searchElement?: any,
  ) {
    const details = await uniwareClient.getOrderDetails(orderCode);

    const dto = details?.saleOrderDTO;

    if (!dto) {
      throw new Error(
        `Empty saleOrderDTO returned for code ${orderCode}`,
      );
    }

    const uniwareOrderCode = String(
      dto.code || orderCode,
    ).trim();

    if (!uniwareOrderCode) {
      throw new Error(
        "Uniware order is missing its order code",
      );
    }

    const shippingAddr =
      dto.addresses?.find(
        (address: any) => address.type === "SHIPPING",
      ) || dto.addresses?.[0];

    const country = String(
      shippingAddr?.country || "IN",
    ).toUpperCase();

    const isExport = country !== "IN";

    const toDateObj = (
      value: any,
    ): Date | undefined => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return undefined;
      }

      const parsed = new Date(value);

      return Number.isNaN(parsed.getTime())
        ? undefined
        : parsed;
    };

    const displayOrderDateTime =
      toDateObj(dto.displayOrderDateTime) ||
      toDateObj(dto.created) ||
      toDateObj(searchElement?.displayOrderDateTime) ||
      toDateObj(searchElement?.created) ||
      new Date();

    const fulfillmentDeadline =
      toDateObj(dto.fulfillmentTat) ||
      toDateObj(searchElement?.fulfillmentTat) ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const uniwareStatus = String(
      dto.status || searchElement?.status || "PROCESSING",
    ).toUpperCase();

    const packageStatuses: string[] = (
      dto.shippingPackages || []
    ).map((pkg: any) =>
      String(pkg.status || "").toUpperCase(),
    );

    const hasShippedPackage = packageStatuses.some(
      (status: string) =>
        [
          "SHIPPED",
          "DISPATCHED",
          "DELIVERED",
        ].includes(status),
    );

    let initialStage: InternalStage = "PRODUCTION";

    let nextAction =
      "Check finished-goods inventory and allocate available quantity; manufacture any shortage";

    let priorityScore = 50;

    let priorityLabel:
      | "LOW"
      | "NORMAL"
      | "HIGH"
      | "URGENT"
      | "OVERDUE" = "NORMAL";

    if (
      ["COMPLETE", "DELIVERED", "SHIPPED"].includes(
        uniwareStatus,
      ) ||
      hasShippedPackage
    ) {
      initialStage = "DELIVERY";
      nextAction =
        "Review shipping package and dispatch status in Uniware";
      priorityScore = 20;
      priorityLabel = "LOW";
    } else if (uniwareStatus === "CANCELLED") {
      initialStage = "CANCELLED";
      nextAction = "Order cancelled in Uniware";
      priorityScore = 0;
      priorityLabel = "LOW";
    }

    // Check if this order has already been imported.
    const existingOrder = await prisma.order.findUnique({
      where: { uniwareOrderCode },
    });

    // Extract items: Uniware order items can be returned under saleOrderItems,
    // saleOrderItemDTOs, or derived from shippingPackages[].items
    let rawItems: any[] =
      dto.saleOrderItems ??
      dto.saleOrderItemDTOs ??
      (Array.isArray(dto.items) ? dto.items : []);

    // If saleOrderItems is empty but shippingPackages contains items map, aggregate from packages
    if (rawItems.length === 0 && Array.isArray(dto.shippingPackages)) {
      for (const pkg of dto.shippingPackages) {
        if (pkg?.items && typeof pkg.items === "object") {
          for (const item of Object.values(pkg.items)) {
            if (item) rawItems.push(item);
          }
        }
      }
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new Error(
        `No sale-order items returned for Uniware order ${uniwareOrderCode}; refusing to create a fake SKU/line`,
      );
    }

    const currency = String(
      dto.currencyCode || dto.currency || "INR",
    ).toUpperCase();

    const totalAmountFromDto = Number(
      dto.totalAmount ?? dto.totalPrice ?? dto.sellingPrice,
    );

    const totalAmount = Number.isFinite(totalAmountFromDto)
      ? totalAmountFromDto
      : 0;

    const isCod = Boolean(
      dto.cod ??
        dto.cashOnDelivery ??
        dto.isCod ??
        false,
    );

    let order = await prisma.order.upsert({
      where: { uniwareOrderCode },

      update: {
        displayOrderCode:
          dto.displayOrderCode ||
          searchElement?.displayOrderCode,

        channel:
          dto.channel ||
          searchElement?.channel ||
          "UNKNOWN",

        source:
          dto.source ||
          searchElement?.source ||
          dto.channel ||
          searchElement?.channel ||
          "UNKNOWN",

        uniwareStatus,
        packagingType: isExport ? "EXPORT" : "DOMESTIC",
        destinationCountry: country,
        shippingAddressCity: shippingAddr?.city || "-",
        shippingAddressState: shippingAddr?.state || "-",
        currency,
        totalAmount,
        isCod,
        displayOrderDateTime,
        fulfillmentDeadline,

        // Preserve the internal workflow for existing orders.
        ...(!existingOrder
          ? {
              internalStage: initialStage,
              nextAction,
              priorityScore,
              priorityLabel,
            }
          : {}),
      },

      create: {
        uniwareOrderCode,

        displayOrderCode:
          dto.displayOrderCode ||
          searchElement?.displayOrderCode,

        channel:
          dto.channel ||
          searchElement?.channel ||
          "UNKNOWN",

        source:
          dto.source ||
          searchElement?.source ||
          dto.channel ||
          searchElement?.channel ||
          "UNKNOWN",

        uniwareStatus,
        internalStage: initialStage,
        packagingType: isExport ? "EXPORT" : "DOMESTIC",
        destinationCountry: country,
        shippingAddressCity: shippingAddr?.city || "-",
        shippingAddressState: shippingAddr?.state || "-",
        currency,
        totalAmount,
        isCod,
        displayOrderDateTime,
        fulfillmentDeadline,
        priorityScore,
        priorityLabel,
        nextAction,
      },
    });

    for (const item of rawItems) {
      const itemSkuCode = String(
        item.itemSku ??
          item.sellerSkuCode ??
          item.channelProductId ??
          item.itemSKU ??
          item.skuCode ??
          "",
      ).trim();

      if (!itemSkuCode) {
        throw new Error(
          `Order ${uniwareOrderCode} contains a line without itemSku/sellerSkuCode/channelProductId`,
        );
      }

      const itemName = String(
        item.itemName || itemSkuCode,
      ).trim();

      // Uniware saleOrderItems represents discrete fulfillment units where each entry represents
      // 1 unit unless item.quantity or totalQuantity is explicitly specified.
      const parsedQty = Number(
        item.quantity ??
          item.totalQuantity ??
          1,
      );
      const qty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;

      const unitPriceValue = Number(
        item.sellingPrice ??
          item.unitPrice ??
          item.price ??
          0,
      );

      const unitPrice = Number.isFinite(unitPriceValue)
        ? unitPriceValue
        : 0;

      let sku = await prisma.sKU.findUnique({
        where: { code: itemSkuCode },
      });

      // Create a basic SKU record if this SKU is not in the catalogue.
      if (!sku) {
        sku = await prisma.sKU.create({
          data: {
            code: itemSkuCode,
            name: itemName,
            category: "General",
            unitOfManufacture: "PCS",
            defaultLeadTimeDays: 7,
            domesticPackingType: "Standard Box",
            exportPackingType:
              "Export Palletized Wooden Crate",
          },
        });
      }

      const uniwareItemCode = String(
        item.code ||
          item.orderItemCode ||
          `${uniwareOrderCode}-${itemSkuCode}`,
      ).trim();

      const existingLine = await prisma.orderLine.findFirst({
        where: {
          orderId: order.id,
          skuId: sku.id,
        },
      });

      if (existingLine) {
        // Refresh Uniware data only.
        // Preserve internal allocation and packing quantities.
        await prisma.orderLine.update({
          where: { id: existingLine.id },

          data: {
            uniwareItemCode,
            quantity: qty,
            unitPrice,
            status: String(
              item.itemStatus || uniwareStatus,
            ),
          },
        });
      } else {
        const isCompleted =
          initialStage === "DELIVERY";

        await prisma.orderLine.create({
          data: {
            orderId: order.id,
            skuId: sku.id,
            uniwareItemCode,
            quantity: qty,
            unitPrice,
            status: String(
              item.itemStatus || uniwareStatus,
            ),
            allocatedPackedQty: isCompleted ? qty : 0,
            packedCompletedQty: isCompleted ? qty : 0,
            dispatchReadyQty: isCompleted ? qty : 0,
          },
        });
      }
    }

    // Process shipping packages if provided by Uniware (creates or updates Shipment tracking)
    if (Array.isArray(dto.shippingPackages) && dto.shippingPackages.length > 0) {
      for (const pkg of dto.shippingPackages) {
        const awb = String(
          pkg.trackingNumber ||
            pkg.channelShipmentCode ||
            pkg.code ||
            "",
        ).trim();

        if (awb) {
          const pkgStatus = String(pkg.status || "").toUpperCase();
          let normalizedStatus: "SHIPMENT_CREATED" | "READY_FOR_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" = "SHIPMENT_CREATED";

          if (pkgStatus === "DELIVERED") {
            normalizedStatus = "DELIVERED";
          } else if (["SHIPPED", "DISPATCHED"].includes(pkgStatus)) {
            normalizedStatus = "IN_TRANSIT";
          } else if (pkgStatus === "READY_TO_SHIP") {
            normalizedStatus = "READY_FOR_PICKUP";
          } else if (pkgStatus === "CANCELLED") {
            normalizedStatus = "CANCELLED";
          }

          const dispatchedAt = toDateObj(pkg.dispatched);
          const deliveredAt = toDateObj(pkg.delivered);
          const courierName = String(
            pkg.shippingCourier ||
              pkg.shippingProvider ||
              pkg.shippingMethod ||
              "Uniware Courier",
          ).trim();

          const scanLocation = (pkg.city || shippingAddr?.city || undefined) as string | undefined;

          await prisma.shipment.upsert({
            where: {
              provider_awbWaybill: {
                provider: "UNIWARE",
                awbWaybill: awb,
              },
            },
            update: {
              orderId: order.id,
              uniwareOrderCode: order.uniwareOrderCode,
              courierName,
              normalizedStatus,
              providerStatus: pkgStatus,
              dispatchedAt: dispatchedAt || undefined,
              deliveredAt: deliveredAt || undefined,
              currentScanActivity: `Package status: ${pkgStatus}`,
              currentScanLocation: scanLocation,
            },
            create: {
              orderId: order.id,
              uniwareOrderCode: order.uniwareOrderCode,
              provider: "UNIWARE",
              awbWaybill: awb,
              courierName,
              normalizedStatus,
              providerStatus: pkgStatus,
              dispatchedAt,
              deliveredAt,
              currentScanActivity: `Package status: ${pkgStatus}`,
              currentScanLocation: scanLocation,
              matchConfidence: "EXACT_AWB",
            },
          });
        }
      }
    }

    // Run allocation only for newly imported production orders.
    // The workflow service should check finished-goods inventory first.
    // RAW_MATERIAL is reserved for an explicit user decision that
    // raw materials are unavailable.
    //
    // Do not rerun allocation on every sync because that could
    // overwrite existing manual workflow decisions.
    if (!existingOrder && initialStage === "PRODUCTION") {
      await workflowService.allocateOrder(order.id);
    }

    // Reconcile order stage against any Shipment record already linked to this order.
    // Covers the late-sync scenario: a webhook stored a shipment before this order was synced,
    // so the order got an initial stage (RAW_MATERIAL / PRODUCTION) that doesn't reflect
    // the shipment's actual progress.
    //
    // Mapping (mirrors webhook handler in shiprocket/service.ts):
    //   SHIPMENT_CREATED / READY_FOR_PICKUP  → DISPATCH  (guard: only if pre-dispatch)
    //   PICKED_UP / IN_TRANSIT / OUT_FOR_DELIVERY / UNDELIVERED / DELIVERED → DELIVERY (guard: only if pre-delivery)
    const linkedShipment = await prisma.shipment.findFirst({
      where: {
        orderId: order.id,
        isUnmatched: false,
        normalizedStatus: {
          in: [
            "SHIPMENT_CREATED",
            "READY_FOR_PICKUP",
            "PICKED_UP",
            "IN_TRANSIT",
            "OUT_FOR_DELIVERY",
            "UNDELIVERED",
            "DELIVERED",
          ],
        },
      },
      orderBy: { updatedAt: "desc" }, // use the most recently updated shipment
    });

    if (linkedShipment) {
      const freshOrder = await prisma.order.findUnique({
        where: { id: order.id },
        select: { internalStage: true },
      });

      if (freshOrder) {
        const preDispatchStages = ["RAW_MATERIAL", "PRODUCTION", "PACKING"];
        const preDeliveryStages = [...preDispatchStages, "DISPATCH"];

        let impliedStage: "DISPATCH" | "DELIVERY" | null = null;

        if (
          linkedShipment.normalizedStatus === "SHIPMENT_CREATED" ||
          linkedShipment.normalizedStatus === "READY_FOR_PICKUP"
        ) {
          if (preDispatchStages.includes(freshOrder.internalStage)) {
            impliedStage = "DISPATCH";
          }
        } else if (
          linkedShipment.normalizedStatus === "PICKED_UP" ||
          linkedShipment.normalizedStatus === "IN_TRANSIT" ||
          linkedShipment.normalizedStatus === "OUT_FOR_DELIVERY" ||
          linkedShipment.normalizedStatus === "UNDELIVERED" ||
          linkedShipment.normalizedStatus === "DELIVERED"
        ) {
          if (preDeliveryStages.includes(freshOrder.internalStage)) {
            impliedStage = "DELIVERY";
          }
        }

        if (impliedStage) {
          // Update the order stage and capture the result so the return value
          // reflects the reconciled stage (fixes sync popup showing wrong stage).
          order = await prisma.order.update({
            where: { id: order.id },
            data: {
              internalStage: impliedStage,
              nextAction: `Sync reconciliation: shipment ${linkedShipment.normalizedStatus} via ${linkedShipment.courierName} (AWB: ${linkedShipment.awbWaybill})`,
              blockerReason: null,
              rawMaterialDecision: null,
            },
          });

          await prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              toStage: impliedStage,
              reason: `Sync: existing shipment AWB ${linkedShipment.awbWaybill} (${linkedShipment.normalizedStatus}) found — stage advanced automatically`,
            },
          });

          // Fix allocation breakdown: the order was force-advanced past the normal
          // inventory allocation flow, so order line quantities still reflect the
          // RAW_MATERIAL/PRODUCTION state. Reset them to reflect a fully dispatched order.
          const orderLines = await prisma.orderLine.findMany({
            where: { orderId: order.id },
            select: { id: true, quantity: true },
          });

          for (const line of orderLines) {
            await prisma.orderLine.update({
              where: { id: line.id },
              data: {
                pendingAssessmentQty: 0,
                blockedRawMaterialQty: 0,
                requiredProductionQty: 0,
                allocatedUnpackedQty: 0,
                allocatedPackedQty: line.quantity,
                packedCompletedQty: line.quantity,
                dispatchReadyQty: line.quantity,
              },
            });
          }

          // Resolve any active RawMaterialBlock entries so the Raw Material queue
          // no longer shows this order as pending/blocked.
          await prisma.rawMaterialBlock.updateMany({
            where: {
              orderId: order.id,
              status: { in: ["PENDING_ASSESSMENT", "BLOCKED"] },
            },
            data: {
              status: "RESOLVED",
              resolvedAt: new Date(),
            },
          });
        }
      }
    }

    return order;
  }
}

export const uniwareSyncService =
  new UniwareSyncService();