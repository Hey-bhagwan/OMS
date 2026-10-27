
export interface UniwareTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export type UniwareSyncDateType = "CREATED" | "UPDATED";

export interface UniwareSearchRequest {
  dateType: UniwareSyncDateType;
  fromDate: string;
  toDate: string;
  searchOptions: {
    displayStart: number;
    displayLength: number;
    getCount: boolean;
  };
}

export interface UniwareSearchResponseElement {
  code: string;
  orderCategory?: string | null;
  displayOrderCode?: string;
  channel?: string;
  source?: string;
  displayOrderDateTime?: string | number;
  status: string;
  created?: string | number;
  updated?: string | number;
  fulfillmentTat?: string | number;
  notificationEmail?: string;
  notificationMobile?: string;
  customerGSTIN?: string | null;
  channelProcessingTime?: string | number;
}

export interface UniwareSearchResponse {
  successful: boolean;
  errors?: Array<{
    code: string;
    message: string;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
  totalRecords?: number;
  elements?: UniwareSearchResponseElement[];
}

export interface UniwareOrderItemDTO {
  code?: string;
  itemSku?: string;
  sellerSkuCode?: string;
  channelProductId?: string;
  itemName?: string;
  quantity?: number;
  totalPrice?: number;
  sellingPrice?: number;
  itemStatus?: string;
  shippingPackageCode?: string;
  facilityCode?: string;

  // Compatibility with older or differently shaped responses.
  itemSKU?: string;
  skuCode?: string;
  unitPrice?: number;
  price?: number;
  [key: string]: unknown;
}

export interface UniwareShippingPackageDTO {
  code?: string;
  status?: string;
  shippingPackageStatus?: string;
  courierCode?: string;
  courierName?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
  dispatchDate?: string;
  deliveredDate?: string;
  [key: string]: unknown;
}

export interface UniwareAddressDTO {
  id?: number;
  name?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  type?: string;
}

export interface UniwareSaleOrderDTO {
  code: string;
  displayOrderCode?: string;
  channel?: string;
  source?: string;
  status: string;
  created?: string | number;
  updated?: string | number;
  currency?: string;
  currencyCode?: string;
  totalPrice?: number;
  totalAmount?: number;
  sellingPrice?: number;
  cod?: boolean;
  cashOnDelivery?: boolean;
  isCod?: boolean;
  fulfillmentTat?: string | number;
  displayOrderDateTime?: string | number;
  addresses?: UniwareAddressDTO[];
  saleOrderItems?: UniwareOrderItemDTO[];
  saleOrderItemDTOs?: UniwareOrderItemDTO[];
  items?: UniwareOrderItemDTO[];
  shippingPackages?: UniwareShippingPackageDTO[];
  [key: string]: unknown;
}

export interface UniwareSaleOrderGetResponse {
  successful: boolean;
  errors?: Array<{
    code: string;
    message: string;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
  saleOrderDTO?: UniwareSaleOrderDTO;
}
