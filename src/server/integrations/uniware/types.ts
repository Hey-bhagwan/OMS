export interface UniwareTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface UniwareSearchRequest {
  dateType: "CREATED" | "UPDATED";
  fromDate: string; // ISO format e.g. 2026-10-01T00:00:00
  toDate: string;   // ISO format e.g. 2026-10-22T23:59:59
  searchOptions: {
    displayStart: number;
    displayLength: number;
    getCount: boolean;
  };
}

export interface UniwareSearchResponseElement {
  code: string;
  displayOrderCode?: string;
  channel?: string;
  source?: string;
  displayOrderDateTime?: string;
  status: string;
  created?: string;
  updated?: string;
  fulfillmentTat?: string;
}

export interface UniwareSearchResponse {
  successful: boolean;
  errors?: Array<{ code: string; message: string }>;
  warnings?: Array<{ code: string; message: string }>;
  totalRecords?: number;
  elements?: UniwareSearchResponseElement[];
}

export interface UniwareOrderItemDTO {
  code: string;
  itemSKU: string;
  itemName?: string;
  quantity?: number;
  totalPrice?: number;
  sellingPrice?: number;
  itemStatus?: string;
  shippingPackageCode?: string;
  facilityCode?: string;
}

export interface UniwareShippingPackageDTO {
  code: string;
  shippingPackageStatus?: string;
  courierCode?: string;
  courierName?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
  dispatchDate?: string;
  deliveredDate?: string;
}

export interface UniwareSaleOrderDTO {
  code: string;
  displayOrderCode?: string;
  channel?: string;
  source?: string;
  status: string;
  created?: string;
  updated?: string;
  currency?: string;
  totalPrice?: number;
  cashOnDelivery?: boolean;
  fulfillmentTat?: string;
  addresses?: Array<{
    id: number;
    name?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    type?: string;
  }>;
  saleOrderItems?: UniwareOrderItemDTO[];
  shippingPackages?: UniwareShippingPackageDTO[];
}

export interface UniwareSaleOrderGetResponse {
  successful: boolean;
  errors?: Array<{ code: string; message: string }>;
  warnings?: Array<{ code: string; message: string }>;
  saleOrderDTO?: UniwareSaleOrderDTO;
}
