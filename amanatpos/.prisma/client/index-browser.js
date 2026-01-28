
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('@prisma/client/runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  name: 'name',
  logoUrl: 'logoUrl',
  companyName: 'companyName',
  contactNumber: 'contactNumber',
  techContact: 'techContact',
  email: 'email',
  address: 'address',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive',
  activeDate: 'activeDate',
  inactiveDate: 'inactiveDate'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  password: 'password',
  role: 'role',
  clientId: 'clientId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  sku: 'sku',
  type: 'type',
  price: 'price',
  costPrice: 'costPrice',
  stock: 'stock',
  lowStockAt: 'lowStockAt',
  isActive: 'isActive',
  isFavorite: 'isFavorite',
  categoryId: 'categoryId',
  defaultTaxId: 'defaultTaxId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RawMaterialScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  sku: 'sku',
  unit: 'unit',
  stock: 'stock',
  lowStockAt: 'lowStockAt',
  isUnlimited: 'isUnlimited',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductRawMaterialScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  productId: 'productId',
  rawMaterialId: 'rawMaterialId',
  quantity: 'quantity',
  unit: 'unit'
};

exports.Prisma.DiscountScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  isPerItem: 'isPerItem',
  percent: 'percent',
  amount: 'amount',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TaxSettingScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  percent: 'percent',
  isDefault: 'isDefault',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceSettingScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  logoUrl: 'logoUrl',
  headerText: 'headerText',
  footerText: 'footerText',
  showTax: 'showTax',
  showDiscount: 'showDiscount',
  showCashier: 'showCashier',
  showCustomer: 'showCustomer',
  customFields: 'customFields',
  taxMode: 'taxMode',
  fontSize: 'fontSize',
  showPriceDecimals: 'showPriceDecimals'
};

exports.Prisma.FBRSettingScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  url: 'url',
  bearerToken: 'bearerToken',
  posId: 'posId',
  usin: 'usin',
  paymentMode: 'paymentMode',
  invoiceType: 'invoiceType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SaleScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  clientId: 'clientId',
  cashierId: 'cashierId',
  subtotal: 'subtotal',
  discount: 'discount',
  couponCode: 'couponCode',
  couponValue: 'couponValue',
  taxPercent: 'taxPercent',
  tax: 'tax',
  total: 'total',
  type: 'type',
  paymentMethod: 'paymentMethod',
  fbrInvoiceId: 'fbrInvoiceId',
  createdAt: 'createdAt',
  customerName: 'customerName',
  customerPhone: 'customerPhone'
};

exports.Prisma.SaleItemScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  saleId: 'saleId',
  productId: 'productId',
  variantId: 'variantId',
  quantity: 'quantity',
  returnedQuantity: 'returnedQuantity',
  price: 'price',
  discount: 'discount',
  tax: 'tax',
  total: 'total'
};

exports.Prisma.HeldBillScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  cashierId: 'cashierId',
  data: 'data',
  createdAt: 'createdAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CouponScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  code: 'code',
  type: 'type',
  value: 'value',
  isActive: 'isActive',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DiscountRuleScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  scope: 'scope',
  type: 'type',
  value: 'value',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductVariantScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  name: 'name',
  sku: 'sku',
  price: 'price',
  costPrice: 'costPrice',
  stock: 'stock',
  lowStockAt: 'lowStockAt',
  attributes: 'attributes',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RefundScalarFieldEnum = {
  id: 'id',
  saleId: 'saleId',
  clientId: 'clientId',
  cashierId: 'cashierId',
  refundId: 'refundId',
  total: 'total',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.RefundItemScalarFieldEnum = {
  id: 'id',
  refundId: 'refundId',
  clientId: 'clientId',
  saleItemId: 'saleItemId',
  productId: 'productId',
  variantId: 'variantId',
  quantity: 'quantity',
  refundAmount: 'refundAmount',
  createdAt: 'createdAt'
};

exports.Prisma.VariantAttributeScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  name: 'name',
  values: 'values',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Role = exports.$Enums.Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER'
};

exports.ProductType = exports.$Enums.ProductType = {
  SIMPLE: 'SIMPLE',
  VARIANT: 'VARIANT',
  COMPOSITE: 'COMPOSITE'
};

exports.CouponType = exports.$Enums.CouponType = {
  PERCENT: 'PERCENT',
  AMOUNT: 'AMOUNT'
};

exports.DiscountScope = exports.$Enums.DiscountScope = {
  ITEM: 'ITEM',
  CART: 'CART'
};

exports.Prisma.ModelName = {
  Client: 'Client',
  User: 'User',
  Product: 'Product',
  RawMaterial: 'RawMaterial',
  ProductRawMaterial: 'ProductRawMaterial',
  Discount: 'Discount',
  TaxSetting: 'TaxSetting',
  InvoiceSetting: 'InvoiceSetting',
  FBRSetting: 'FBRSetting',
  Sale: 'Sale',
  SaleItem: 'SaleItem',
  HeldBill: 'HeldBill',
  Category: 'Category',
  Coupon: 'Coupon',
  DiscountRule: 'DiscountRule',
  ProductVariant: 'ProductVariant',
  Refund: 'Refund',
  RefundItem: 'RefundItem',
  VariantAttribute: 'VariantAttribute'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
