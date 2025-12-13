"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = require("bcryptjs");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var client, adminPassword, cashierPassword, admin, cashier, rm1, rm2, espresso, milkCoffee;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.client.upsert({
                        where: { id: 'seed-client-1' },
                        update: {},
                        create: {
                            id: 'seed-client-1',
                            name: 'Amanat Demo',
                        },
                    })];
                case 1:
                    client = _a.sent();
                    return [4 /*yield*/, bcrypt.hash('admin123', 10)];
                case 2:
                    adminPassword = _a.sent();
                    return [4 /*yield*/, bcrypt.hash('cashier123', 10)];
                case 3:
                    cashierPassword = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'admin@amanat.local' },
                            update: {},
                            create: {
                                email: 'admin@amanat.local',
                                name: 'Demo Admin',
                                password: adminPassword,
                                role: client_1.Role.ADMIN,
                                clientId: client.id,
                            },
                        })];
                case 4:
                    admin = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'cashier@amanat.local' },
                            update: {},
                            create: {
                                email: 'cashier@amanat.local',
                                name: 'Demo Cashier',
                                password: cashierPassword,
                                role: client_1.Role.CASHIER,
                                clientId: client.id,
                            },
                        })];
                case 5:
                    cashier = _a.sent();
                    return [4 /*yield*/, prisma.invoiceSetting.upsert({
                            where: { clientId: client.id },
                            update: {},
                            create: {
                                clientId: client.id,
                                headerText: 'Amanat POS Invoice',
                                footerText: 'Thank you for your business!',
                                showTax: true,
                                showDiscount: true,
                                showCashier: true,
                                showCustomer: true,
                            },
                        })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, prisma.taxSetting.createMany({
                            data: [
                                { clientId: client.id, name: 'VAT', percent: 5, isActive: true },
                                { clientId: client.id, name: 'GST', percent: 10, isActive: false },
                            ],
                            skipDuplicates: true,
                        })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, prisma.discount.createMany({
                            data: [
                                { clientId: client.id, name: 'Item 5% Off', isPerItem: true, percent: 5 },
                                { clientId: client.id, name: 'Bill 20 Off', isPerItem: false, amount: 20 },
                            ],
                            skipDuplicates: true,
                        })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, prisma.rawMaterial.upsert({
                            where: { sku: 'RM-COFFEE-BEANS' },
                            update: {},
                            create: {
                                clientId: client.id,
                                name: 'Coffee Beans',
                                sku: 'RM-COFFEE-BEANS',
                                stock: 1000,
                                lowStockAt: 200,
                            },
                        })];
                case 9:
                    rm1 = _a.sent();
                    return [4 /*yield*/, prisma.rawMaterial.upsert({
                            where: { sku: 'RM-MILK' },
                            update: {},
                            create: {
                                clientId: client.id,
                                name: 'Milk',
                                sku: 'RM-MILK',
                                stock: 500,
                                lowStockAt: 100,
                            },
                        })];
                case 10:
                    rm2 = _a.sent();
                    return [4 /*yield*/, prisma.product.upsert({
                            where: { sku: 'PR-ESPRESSO' },
                            update: {},
                            create: {
                                clientId: client.id,
                                name: 'Espresso',
                                sku: 'PR-ESPRESSO',
                                type: 'COMPOSITE',
                                price: 3.5,
                                stock: 100,
                                lowStockAt: 20,
                            },
                        })];
                case 11:
                    espresso = _a.sent();
                    return [4 /*yield*/, prisma.product.upsert({
                            where: { sku: 'PR-MILK-COFFEE' },
                            update: {},
                            create: {
                                clientId: client.id,
                                name: 'Milk Coffee',
                                sku: 'PR-MILK-COFFEE',
                                type: 'COMPOSITE',
                                price: 4.5,
                                stock: 120,
                                lowStockAt: 25,
                            },
                        })];
                case 12:
                    milkCoffee = _a.sent();
                    return [4 /*yield*/, prisma.productRawMaterial.createMany({
                            data: [
                                { clientId: client.id, productId: espresso.id, rawMaterialId: rm1.id, quantity: 10 },
                                { clientId: client.id, productId: milkCoffee.id, rawMaterialId: rm1.id, quantity: 8 },
                                { clientId: client.id, productId: milkCoffee.id, rawMaterialId: rm2.id, quantity: 2 },
                            ],
                            skipDuplicates: true,
                        })];
                case 13:
                    _a.sent();
                    console.log('Seed complete:', { client: client.name, admin: admin.email, cashier: cashier.email });
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) {
    console.error(e);
    process.exit(1);
}).finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
