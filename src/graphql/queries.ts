import { gql } from '@apollo/client';

// Query para obtener documentos disponibles
export const GET_DOCUMENTS = gql`
  query GetDocuments($branchId: ID!) {
    documentsByBranch(branchId: $branchId) {
      id
      code
      description
      isActive
    }
  }
`;

// Query para obtener series de un documento
export const GET_SERIALS_BY_DOCUMENT = gql`
  query GetSerialsByDocument($documentId: ID!) {
    serialsByDocument(documentId: $documentId) {
      id
      serial
      isActive
    }
  }
`;

// Query para obtener documentos con sus series incluidas
export const GET_DOCUMENTS_WITH_SERIALS = gql`
  query GetDocumentsWithSerials($branchId: ID!) {
    documentsByBranch(branchId: $branchId) {
      id
      code
      description
      isActive
      serials {
        id
        serial
        isActive
      }
    }
  }
`;


// Query para obtener cajas registradoras de la sucursal
export const GET_CASH_REGISTERS = gql`
  query GetCashRegisters($branchId: ID!) {
    cashRegistersByBranch(branchId: $branchId) {
      id
      name
      cashType
      currentBalance
      isActive
    }
  }
`;


// Query para obtener la operación activa de una mesa
export const GET_OPERATION_BY_TABLE = gql`
  query GetOperationByTable($tableId: ID!, $branchId: ID!) {
    operationByTable(tableId: $tableId, branchId: $branchId) {
      id
      order
      status
      total
      subtotal
      igvAmount
      igvPercentage
      operationType
      operationDate
      user {
        id
        firstName
        lastName
        fullName
        dni
      }
      details {
        id
        productId
        productCode
        productName
        productDescription
        quantity
        unitMeasure
        unitValue
        unitPrice
        total
        notes
        isCanceled 
        isPrinted
        printedAt
      }
    }
  }
`;


// Query para obtener una operación por su ID
export const GET_OPERATION_BY_ID = gql`
  query GetOperationById($operationId: ID!) {
    operationById(pk: $operationId) {
      id
      order
      status
      operationType
      operationDate
      subtotal
      igvAmount
      igvPercentage
      total
      notes
      tableId
      table {
        id
        name
      }
      userId
      user {
        id
        firstName
        lastName
        fullName
        dni
      }
      personId
      branchId
      details {
        id
        quantity
        unitMeasure
        unitValue
        unitPrice
        total
        notes
        productId
        productCode
        productName
        productDescription
        isCanceled
        isPrepared
        isPrinted
        issuedItems {
          id
          quantity
          issuedDocument {
            id
            billingStatus
          }
        }
      }
    }
  }
`;

// Query para obtener pisos de la sucursal
export const GET_FLOORS_BY_BRANCH = gql`
  query GetFloorsByBranch($branchId: ID!) {
    floorsByBranch(branchId: $branchId) {
      id
      name
      capacity
      order
      isActive
      floorImageBase64
    }
  }
`;

// Query para obtener mesas de un piso específico
export const GET_TABLES_BY_FLOOR = gql`
  query GetTablesByFloor($floorId: ID!) {
    tablesByFloor(floorId: $floorId) {
      id
      name
      shape
      positionX
      positionY
      capacity
      isActive
      status
      statusColors
      currentOperationId
      currentOperation {
        id
        operationDate
      }
      occupiedById
      userName
      isActive
    }
  }
`;

// Query para obtener categorías de la sucursal
export const GET_CATEGORIES_BY_BRANCH = gql`
  query GetCategoriesByBranch($branchId: ID!) {
    categoriesByBranch(branchId: $branchId) {
      id
      name
      description
      icon
      color
      order
      isActive
      subcategories {
        id
        name
        description
        icon
        color
        order
        isActive
      }
    }
  }
`;

// Query para obtener subcategorías por categoría
export const GET_SUBCATEGORIES_BY_CATEGORY = gql`
  query GetSubcategoriesByCategory($categoryId: ID!) {
    subcategoriesByCategory(categoryId: $categoryId) {
      id
      name
      description
      icon
      color
      order
      isActive
    }
  }
`;

// Query para obtener productos por categoría
export const GET_PRODUCTS_BY_CATEGORY = gql`
  query GetProductsByCategory($categoryId: ID!) {
    productsByCategory(categoryId: $categoryId) {
      id
      code
      name
      description
      salePrice
      imageBase64
      preparationTime
      productType
      isActive
      subcategoryId
    }
  }
`;

// Query para obtener todos los productos de la sucursal
export const GET_PRODUCTS_BY_BRANCH = gql`
  query GetProductsByBranch($branchId: ID!) {
    productsByBranch(branchId: $branchId) {
      id
      code
      name
      description
      salePrice
      imageBase64
      preparationTime
      productType
      isActive
      subcategoryId
      subcategory {
        id
        name
        category {
          id
          name
        }
      }
      purchasePrice
      unitMeasure
      currentStock
      stockMin
      stockMax
      managesStock
    }
  }
`;

// Query para obtener productos con filtros opcionales (tipo y categoría)
export const GET_PRODUCTS = gql`
  query GetProducts($branchId: ID!, $productType: String, $categoryId: ID) {
    products(branchId: $branchId, productType: $productType, categoryId: $categoryId) {
      id
      code
      name
      description
      salePrice
      imageBase64
      preparationTime
      productType
      isActive
      subcategoryId
      subcategory {
        id
        name
        category {
          id
          name
        }
      }
      purchasePrice
      unitMeasure
      currentStock
      stockMin
      stockMax
      managesStock
    }
  }
`;

// Query para obtener productos con información de inventario
export const GET_PRODUCTS_WITH_STOCK = gql`
  query GetProductsWithStock($branchId: ID!) {
    productsByBranch(branchId: $branchId) {
      id
      code
      name
      description
      salePrice
      purchasePrice
      unitMeasure
      currentStock
      stockMin
      stockMax
      imageBase64
      isActive
      productType
      subcategoryId
      managesStock
    }
  }
`;

// Query para obtener producto por código (productByCode en schema camelCase)
// Búsqueda exacta, insensible a mayúsculas/minúsculas
export const GET_PRODUCT_BY_CODE = gql`
  query GetProductByCode($branchId: ID!, $code: String!) {
    productByCode(branchId: $branchId, code: $code) {
      id
      code
      name
      description
      salePrice
      imageBase64
      preparationTime
      isActive
      subcategoryId
      productType
      purchasePrice
      unitMeasure
      currentStock
      stockMin
      stockMax
      managesStock
    }
  }
`;

// Query para buscar productos
export const SEARCH_PRODUCTS = gql`
  query SearchProducts($search: String!, $branchId: ID!, $limit: Int) {
    searchProducts(search: $search, branchId: $branchId, limit: $limit) {
      id
      code
      name
      description
      salePrice
      imageBase64
      preparationTime
      isActive
      subcategoryId
      productType
      purchasePrice
      unitMeasure
      currentStock
      stockMin
      stockMax
      managesStock
    }
  }
`;

// Query para obtener mensajes broadcast no leídos del usuario actual
export const GET_MY_UNREAD_MESSAGES = gql`
  query GetMyUnreadMessages {
    myUnreadMessages {
      id
      message
      recipients
      createdAt
      sender {
        id
        fullName
        role
      }
    }
  }
`;

// Query para obtener sucursales
export const GET_BRANCHES = gql`
  query GetBranches {
    branches {
      id
      name
      isActive
    }
  }
`;

// Query para obtener datos completos de una sucursal (multisucursal)
// Nota: Si el backend no tiene branchById, switchBranch usará un fallback con queries existentes
export const GET_BRANCH_FULL = gql`
  query GetBranchFull($branchId: ID!) {
    branch(id: $branchId) {
      id
      serial
      name
      address
      phone
      logo
      latitude
      longitude
      igvPercentage
      pdfSize
      pdfColor
      isActive
      isPayment
      isBilling
      isDelivery
      isMultiWaiterEnabled
      isCommandItemMode
      isKitchenPrint
      isKitchenDisplay
      requireWaiterPassword
      users {
        id
        firstName
        lastName
        dni
        role
      }
      floors {
        id
        name
        capacity
        floorImage
        isActive
        order
        tables {
          id
          name
          shape
          positionX
          positionY
          capacity
          status
          isActive
          statusColors
          currentOperationId
          occupiedById
          userName
        }
      }
      categories {
        id
        name
        description
        order
        isActive
        subcategories {
          id
          name
          description
          order
          isActive
          notes {
            id
            note
            isActive
          }
        }
      }
    }
  }
`;

// Query para obtener usuarios/empleados por sucursal
export const GET_USERS_BY_BRANCH = gql`
  query GetUsersByBranch($branchId: ID!) {
    usersByBranch(branchId: $branchId) {
      id
      dni
      email
      firstName
      lastName
      fullName
      role
      phone
      isActive
      photoBase64
      customPermissions
    }
  }
`;

// Solo ADMIN: lista de permisos disponibles (códigos del sistema)
// Backend Graphene suele exponer el campo como available_permissions (snake_case)
export const GET_AVAILABLE_PERMISSIONS = gql`
  query GetAvailablePermissions {
    available_permissions {
      id
      code
      name
      description
    }
  }
`;

// Query para buscar empleados (nombre, apellido, DNI) - para reporte de empleados
export const SEARCH_USERS = gql`
  query SearchUsers($branchId: ID!, $query: String!) {
    searchUsers(branchId: $branchId, query: $query) {
      id
      dni
      firstName
      lastName
      fullName
      role
    }
  }
`;

// Query para obtener resumen de pagos
export const GET_PAYMENT_SUMMARY = gql`
  query GetPaymentSummary($branchId: ID!) {
    paymentSummary(branchId: $branchId) {
      totalPayments
      totalIncome
      totalExpenses
      pendingPayments
      paidPayments
      cashBalance
      digitalBalance
      bankBalance
    }
  }
`;

// Query para obtener resumen de métodos de pago
export const GET_PAYMENT_METHODS_SUMMARY = gql`
  query GetPaymentMethodsSummary($branchId: ID!) {
    paymentMethodsSummary(branchId: $branchId) {
      method
      totalAmount
      count
      percentage
    }
  }
`;

// Query para obtener preview de cierre de caja
export const GET_CASH_CLOSURE_PREVIEW = gql`
  query GetCashClosurePreview($branchId: ID!, $cashRegisterId: ID!, $userId: ID) {
    cashClosurePreview(branchId: $branchId, cashRegisterId: $cashRegisterId, userId: $userId) {
      branchId
      branchName
      cashRegisterId
      cashRegisterName
      nextClosureNumber
      totalPaymentsPending
      totalIncome
      totalExpense
      netTotal
      canClose
      previewDate
      usersSummary {
        userId
        userName
        userRole
        totalIncome
        totalExpense
        netTotal
        paymentsCount
        operationsCount
        dishesCount
        hasOccupiedTables
        occupiedTablesCount
        occupiedTablesNames
        canClose
        paymentMethods {
          methodCode
          methodName
          income
          expense
          net
        }
      }
      generalPaymentMethods {
        methodCode
        methodName
        income
        expense
        net
      }
      warnings {
        type
        message
      }
    }
  }
`;

// Query para obtener cierres de caja
export const GET_CASH_CLOSURES = gql`
  query GetCashClosures($branchId: ID!, $userId: ID, $startDate: Date, $endDate: Date) {
    cashClosures(branchId: $branchId, userId: $userId, startDate: $startDate, endDate: $endDate) {
      id
      closureNumber
      closedAt
      totalIncome
      totalExpense
      netTotal
      user {
        id
        fullName
        role
      }
      cashRegister {
        id
        name
        cashType
      }
      branch {
        id
        name
      }
    }
  }
`;

// Query para obtener pagos pendientes de cierre (movimientos de caja sin cerrar)
export const GET_PAYMENTS_PENDING_CLOSURE = gql`
  query GetPaymentsPendingClosure(
    $cashRegisterId: ID!
    $transactionType: String
    $paymentMethod: String
  ) {
    paymentsPendingClosure(
      cashRegisterId: $cashRegisterId
      transactionType: $transactionType
      paymentMethod: $paymentMethod
    ) {
      id
      paymentDate
      paidAmount
      totalAmount
      transactionType
      paymentMethod
      status
      user {
        id
        fullName
      }
      operation {
        id
        order
      }
      issuedDocument {
        id
        serial
        number
      }
      notes
    }
  }
`;

// Query para obtener pagos de un cierre de caja (detalle)
export const GET_PAYMENTS_BY_CLOSURE = gql`
  query GetPaymentsByClosure($cashClosureId: ID!) {
    paymentsByClosure(cashClosureId: $cashClosureId) {
      id
      paymentDate
      paidAmount
      totalAmount
      transactionType
      paymentMethod
      status
      user {
        id
        fullName
      }
      operation {
        id
        order
      }
      issuedDocument {
        id
        serial
        number
      }
      notes
    }
  }
`;

// Query para obtener recetas de un producto
export const GET_RECIPES_BY_PRODUCT = gql`
  query GetRecipesByProduct($productId: ID!) {
    recipesByProduct(productId: $productId) {
      id
      quantity
      unitMeasure
      notes
      product {
        id
        name
        code
      }
      ingredient {
        id
        name
        code
        unitMeasure
      }
    }
  }
`;

// Query para obtener stocks por sucursal (Stock actual desde el servidor)
export const GET_STOCKS_BY_BRANCH = gql`
  query GetStocksByBranch($branchId: ID!) {
    stocksByBranch(branchId: $branchId) {
      id
      currentQuantity
      averageCost
      product {
        id
        code
        name
        productType
        unitMeasure
        isActive
      }
    }
  }
`;

// Query para obtener reporte de movimientos de stock (Kardex)
// StockMovementsReportResultType tiene: movements (lista) y openingBalances (lista)
export const GET_STOCK_MOVEMENTS_REPORT = gql`
  query GetStockMovementsReport(
    $branchId: ID!
    $productId: ID
    $startDate: DateTime!
    $endDate: DateTime!
  ) {
    stockMovementsReport(
      branchId: $branchId
      productId: $productId
      startDate: $startDate
      endDate: $endDate
    ) {
      movements {
        id
        movementType
        movementTypeDisplay
        quantity
        unitCost
        totalCost
        reason
        createdAt
        productId
        productCode
        productName
        productType
        productTypeDisplay
        stockId
        currentQuantity
        averageCost
        operationId
        operationOrder
        operationType
        operationDate
        userId
        userName
        branchId
        branchName
      }
      openingBalances {
        stockId
        productId
        openingQuantity
      }
    }
  }
`;

// Query para obtener todas las personas de la sucursal (se filtra por isSupplier en el frontend)
export const GET_PERSONS_BY_BRANCH = gql`
  query GetPersonsByBranch($branchId: ID!) {
    personsByBranch(branchId: $branchId) {
      id
      name
      documentType
      documentNumber
      email
      phone
      address
      isSupplier
      isActive
    }
  }
`;

// Query para obtener proveedores (personas con is_supplier=true)
// Usa GET_PERSONS_BY_BRANCH y filtra en el frontend
export const GET_SUPPLIERS_BY_BRANCH = GET_PERSONS_BY_BRANCH;

// Query para obtener operaciones de compra (usando purchases_by_branch del backend)
export const GET_PURCHASE_OPERATIONS = gql`
  query GetPurchaseOperations($branchId: ID!) {
    purchasesByBranch(branchId: $branchId) {
      id
      order
      operationDate
      status
      subtotal
      igvAmount
      igvPercentage
      total
      notes
      cancelledAt
      person {
        id
        name
        documentNumber
      }
      user {
        id
        fullName
      }
      details {
        id
        quantity
        unitMeasure
        unitValue
        unitPrice
        notes
        isCanceled
        product {
          id
          code
          name
          productType
          unitMeasure
        }
      }
    }
  }
`;

// Query para obtener una operación de compra por ID
export const GET_PURCHASE_OPERATION = gql`
  query GetPurchaseOperation($operationId: ID!) {
    purchaseOperation(operationId: $operationId) {
      id
      order
      operationDate
      status
      subtotal
      igvAmount
      igvPercentage
      total
      notes
      cancelledAt
      person {
        id
        name
        documentNumber
        email
        phone
      }
      user {
        id
        fullName
      }
      details {
        id
        quantity
        unitMeasure
        unitValue
        unitPrice
        notes
        isCanceled
        product {
          id
          code
          name
          productType
          unitMeasure
          purchasePrice
        }
      }
    }
  }
`;

// Query para obtener reporte de ventas (documentos emitidos)
export const GET_SALES_REPORT = gql`
  query GetSalesReport(
    $branchId: ID!
    $startDate: Date!
    $endDate: Date!
    $documentId: ID
  ) {
    salesReport(
      branchId: $branchId
      startDate: $startDate
      endDate: $endDate
      documentId: $documentId
    ) {
      documents {
        id
        serial
        number
        emissionDate
        emissionTime
        totalAmount
        totalDiscount
        billingStatus
        igvAmount
        notes
        document {
          id
          code
          description
        }
        person {
          id
          name
          documentNumber
          documentType
        }
        operation {
          id
          order
          status
          operationType
          table {
            id
            name
          }
        }
        items {
          id
          quantity
          unitValue
          unitPrice
          discount
          subtotal
          total
          operationDetail {
            id
            notes
            product {
              id
              code
              name
            }
          }
        }
        payments {
          id
          paymentMethod
          paidAmount
          paymentDate
          status
        }
        user {
          id
          fullName
        }
        branch {
          id
          name
        }
      }
      summary {
        totalDocuments
        totalAmount
        totalCash
        totalYape
        totalPlin
        totalCard
        totalTransfer
        totalOthers
      }
    }
  }
`;

// Query para obtener reporte de productos vendidos
export const GET_SOLD_PRODUCTS_REPORT = gql`
  query GetSoldProductsReport(
    $branchId: ID!
    $startDate: Date!
    $endDate: Date!
    $productId: ID
  ) {
    soldProductsReport(
      branchId: $branchId
      startDate: $startDate
      endDate: $endDate
      productId: $productId
    ) {
      products {
        code
        name
        totalQuantity
        avgUnitPrice
        totalAmount
      }
      summary {
        totalItemsSold
        grandTotal
      }
    }
  }
`;

// Query para obtener reporte de ventas por empleado
export const GET_USER_SALES_REPORT = gql`
  query GetUserSalesReport(
    $branchId: ID!
    $userId: ID!
    $startDate: Date!
    $endDate: Date!
  ) {
    userSalesReport(
      branchId: $branchId
      userId: $userId
      startDate: $startDate
      endDate: $endDate
    ) {
      operations {
        id
        order
        operationDate
        total
        status
        user {
          id
          fullName
        }
      }
      summary {
        totalOperations
        grandTotal
      }
    }
  }
`;

// Query para obtener reporte de anulaciones
export const GET_CANCELLATION_REPORT = gql`
  query GetCancellationReport($branchId: ID!, $startDate: Date!, $endDate: Date!) {
    cancellationReport(branchId: $branchId, startDate: $startDate, endDate: $endDate) {
      operations {
        operationId 
        order 
        status
        tableName 
        waiterName 
        cancelledByName
        operationDate 
        cancelledAt
        cancelledItems {
          detailId
          productName
          quantity
          unitPrice
          total
          notes 
          createdAt
          createdByName
          cancelledAt
          cancelledByName
        }
        cancelledTotal  
      }
      summary {
        totalOperations 
        totalCancelledItems
        totalCancelledAmount
      }
    }
  }
`;


// Query para obtener subcategorías con sus modificadores
export const GET_SUBCATEGORIES_WITH_MODIFIERS = gql`
  query GetSubcategoriesWithModifiers($branchId: ID!) {
    categoriesByBranch(branchId: $branchId) {
      id
      name
      icon
      color
      subcategories {
        id
        name
        description
        icon
        color
        order
        isActive
        notes {
          id
          note
          isActive
        }
      }
    }
  }
`;

// Query para obtener modificadores de una subcategorías
export const GET_MODIFIERS_BY_SUBCATEGORY = gql`
  query GetModifiersBySubcategory($subcategoryId: ID!) {
    notesBySubcategory(subcategoryId: $subcategoryId) {
      id
      note
      isActive
      createdAt
      updatedAt
      subcategory {
        id
        name
        category {
          id
          name
        }
      }
    }
  }
`;

// Query para buscar persona por documento (DNI/RUC) en local o SUNAT
export const SEARCH_PERSON_BY_DOCUMENT = gql`
  query SearchPersonByDocument($documentType: String!, $documentNumber: String!, $branchId: ID!) {
    searchPersonByDocument(documentType: $documentType, documentNumber: $documentNumber, branchId: $branchId) {
      foundLocally
      foundInSunat
      person {
        id
        name
        documentType
        documentNumber
        email
        phone
        address
        isSupplier
        isActive
        isCustomer
      }
    }
  }
`;


// Query para obtener items disponibles para re-emitir desde documento anulado
export const GET_REISSUEABLE_ITEMS = gql`
  query GetReissueableItems($annulledDocumentId: ID!) {
    reissueableItems(annulledDocumentId: $annulledDocumentId) {
      operationDetailId
      productName
      originalQuantity
      remainingQuantity
      unitValue
      unitPrice
      discount
    }
  }
`;

// ——— Impresoras y Raspberry Pi (configuración) ———
// Schema usa camelCase: raspberryPiByBranch, printersByBranch, categoryPrintersByBranch
export const GET_PRINTERS_CONFIG = gql`
  query GetPrintersConfig($branchId: ID!) {
    raspberryPiByBranch(branchId: $branchId) {
      id
      name
      branch { id }
    }
    printersByBranch(branchId: $branchId) {
      id
      name
      code
      ipAddress
      port
      printerType
      paperWidth
      charactersPerLine
      encoding
      isKitchen
      isBar
      isCashier
      isReceipt
      isInvoice
      isActive
      raspberryPi { id name }
    }
    categoryPrintersByBranch(branchId: $branchId) {
      id
      priority
      isActive
      category { id name }
      printer { id name }
    }
  }
`;

// Aliases para compatibilidad con el componente Delivery
export const GET_DOCUMENTS_BY_BRANCH = GET_DOCUMENTS;
export const GET_CASH_REGISTERS_BY_BRANCH = GET_CASH_REGISTERS;

// Query para buscar personas (clientes/proveedores) por nombre o documento
export const SEARCH_PERSONS = gql`
  query SearchPersons($search: String!, $branchId: ID!, $limit: Int) {
    searchPersons(search: $search, branchId: $branchId, limit: $limit) {
      id
      name
      documentType
      documentNumber
      email
      phone
      address
      isSupplier
      isCustomer
      isActive
    }
  }
`;