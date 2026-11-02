"use client";

import React from "react";

export interface PrintableOrderItem {
  skuCode: string;
  skuName?: string;
  quantity: number;
}

export interface PrintableOrder {
  orderId?: string;
  orderCode: string;
  displayOrderCode?: string | null;
  channel: string;
  items: PrintableOrderItem[];
}

interface OrderPrintViewProps {
  pageTitle: string;
  orders: PrintableOrder[];
}

export const OrderPrintView: React.FC<OrderPrintViewProps> = ({ pageTitle, orders }) => {
  // Consolidate/group orders by orderCode to avoid duplicates when multiple tasks belong to the same order
  const orderMap = new Map<string, PrintableOrder>();

  orders.forEach((o) => {
    const key = o.orderCode || o.orderId || Math.random().toString();
    if (!orderMap.has(key)) {
      orderMap.set(key, {
        orderId: o.orderId,
        orderCode: o.orderCode,
        displayOrderCode: o.displayOrderCode,
        channel: o.channel || "N/A",
        items: [...(o.items || [])],
      });
    } else {
      const existing = orderMap.get(key)!;
      const itemMap = new Map<string, PrintableOrderItem>();
      existing.items.forEach((it) => itemMap.set(it.skuCode, { ...it }));
      (o.items || []).forEach((it) => {
        if (!itemMap.has(it.skuCode)) {
          itemMap.set(it.skuCode, { ...it });
        }
      });
      existing.items = Array.from(itemMap.values());
    }
  });

  const consolidatedOrders = Array.from(orderMap.values());

  return (
    <div className="hidden print:block print:w-full print:p-6 text-black bg-white">
      {/* Print Header */}
      <div className="border-b-2 border-stone-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase font-mono">
            KOA LIVING OMS — {pageTitle}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Printed on: {new Date().toLocaleString()}
          </p>
        </div>
        <div className="text-right text-xs font-semibold text-stone-700">
          Total Orders: {consolidatedOrders.length}
        </div>
      </div>

      {/* Simplified Print Table: Order ID, Channel, SKUs, Quantity */}
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-stone-800 bg-stone-100">
            <th className="py-2.5 px-3 font-bold uppercase text-stone-900 w-1/4">Order ID</th>
            <th className="py-2.5 px-3 font-bold uppercase text-stone-900 w-1/6">Channel</th>
            <th className="py-2.5 px-3 font-bold uppercase text-stone-900 w-5/12">SKU</th>
            <th className="py-2.5 px-3 font-bold uppercase text-stone-900 w-1/6 text-right">Quantity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {consolidatedOrders.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-8 text-center text-stone-500 italic">
                No orders available.
              </td>
            </tr>
          ) : (
            consolidatedOrders.map((ord, idx) => {
              const items = ord.items && ord.items.length > 0
                ? ord.items
                : [{ skuCode: "N/A", skuName: "", quantity: 0 }];

              return (
                <tr key={idx} className="border-b border-stone-200 break-inside-avoid">
                  <td className="py-2.5 px-3 font-mono font-bold align-top text-stone-900">
                    <div>{ord.orderCode}</div>
                    {ord.displayOrderCode && (
                      <div className="text-[10px] font-normal text-stone-500 font-sans">
                        Ref: {ord.displayOrderCode}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 uppercase font-medium align-top text-stone-800">
                    {ord.channel}
                  </td>
                  <td className="py-2.5 px-3 align-top" colSpan={2}>
                    <table className="w-full">
                      <tbody>
                        {items.map((it, itemIdx) => (
                          <tr
                            key={itemIdx}
                            className={itemIdx > 0 ? "border-t border-stone-100" : ""}
                          >
                            <td className="py-1 font-mono font-semibold text-stone-900">
                              {it.skuCode}
                              {it.skuName && (
                                <span className="block text-[10px] font-normal text-stone-600 font-sans">
                                  {it.skuName}
                                </span>
                              )}
                            </td>
                            <td className="py-1 text-right font-mono font-bold text-stone-900 w-1/3 pr-2">
                              {it.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
