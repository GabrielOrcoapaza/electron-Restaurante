import { gql } from '@apollo/client';


// Mutación para login de empresa (primer paso)
export const COMPANY_LOGIN = gql`
  mutation CompanyLogin($ruc: String!, $email: String!, $password: String!) {
    companyLogin(ruc: $ruc, email: $email, password: $password) {
      success
      message
      company {
        id
        ruc
        denomination
        commercialName
        address
        phone
        email
        logo
        isActive
      }
      branch {
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
        users {
          id
          firstName
          lastName 
          dni
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
          icon
          color
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
      companyLogoBase64
      branchLogoBase64
    }
  }
`;

export const USER_LOGIN = gql`
  mutation UserLogin($dni: String!, $password: String!, $branchId: ID!, $deviceId: String!) {
    userLogin(dni: $dni, password: $password, branchId: $branchId, deviceId: $deviceId) {
      success
      message
      token
      refreshToken
      user {
        id
        dni
        firstName
        lastName
        fullName
        role
      }
      userPhotoBase64
      branch {
        id
        name
      }
      deviceRegistered 
    }
  }
`;

// Mutación para actualizar el estado de una mesa
export const UPDATE_TABLE_STATUS = gql`
  mutation UpdateTableStatus($tableId: ID!, $status: String!, $userId: ID) {
    updateTableStatus(tableId: $tableId, status: $status, userId: $userId) {
      success
      message
      table {
        id
        name
        status
        statusColors
        currentOperationId
        occupiedById
        userName
        capacity
        shape
        positionX
        positionY
      }
    }
  }
`;

// Mutación para crear una operación (orden)
export const CREATE_OPERATION = gql`
  mutation CreateOperation(
    $branchId: ID!
    $tableId: ID
    $userId: ID
    $personId: ID
    $operationType: String!
    $serviceType: String
    $status: String
    $notes: String
    $details: [OperationDetailInput!]!
    $deviceId: String
    $subtotal: Float
    $igvAmount: Float
    $igvPercentage: Float
    $total: Float
    $deliveryAddress: String
    $deliveryLatitude: Float
    $deliveryLongitude: Float
    $operationDate: String
    $shouldPrint: Boolean
  ) {
    createOperation(
      branchId: $branchId
      tableId: $tableId
      userId: $userId
      personId: $personId
      operationType: $operationType
      serviceType: $serviceType
      status: $status
      notes: $notes
      details: $details
      deviceId: $deviceId
      subtotal: $subtotal
      igvAmount: $igvAmount
      igvPercentage: $igvPercentage
      total: $total
      deliveryAddress: $deliveryAddress
      deliveryLatitude: $deliveryLatitude
      deliveryLongitude: $deliveryLongitude
      operationDate: $operationDate
      shouldPrint: $shouldPrint
    ) {
      success
      message
      operation {
        id
        order
        status
        total
        operationDate
      }
    }
  }
`;

export const ADD_ITEMS_TO_OPERATION = gql`
  mutation AddItemsToOperation($operationId: ID!, $details: [OperationDetailInput!]!, $deviceId: String!) {
    addItemsToOperation(operationId: $operationId, details: $details, deviceId: $deviceId) {
      success
      message
      newDetailIds
      operation {
        id
        order
        status
        total
      }
    }
  }
`;

// Mutación para crear documento emitido (pago)
export const CREATE_ISSUED_DOCUMENT = gql`
  mutation CreateIssuedDocument(
    $operationId: ID!
    $branchId: ID!
    $documentId: ID!
    $serial: String!
    $personId: ID
    $userId: ID!
    $emissionDate: Date!
    $emissionTime: Time!
    $currency: String!
    $exchangeRate: Float!
    $itemsTotalDiscount: Float!
    $globalDiscount: Float!
    $globalDiscountPercent: Float!
    $totalDiscount: Float!
    $igvPercent: Float!
    $igvAmount: Float!
    $totalTaxable: Float!
    $totalUnaffected: Float!
    $totalExempt: Float!
    $totalFree: Float!
    $totalAmount: Float!
    $items: [IssuedDocumentItemInput!]!
    $payments: [PaymentInput!]!
    $notes: String
    $tableId: ID
    $deviceId: String
    $printerId: ID
  ) {
    createIssuedDocument(
      operationId: $operationId
      branchId: $branchId
      documentId: $documentId
      serial: $serial
      personId: $personId
      userId: $userId
      emissionDate: $emissionDate
      emissionTime: $emissionTime
      currency: $currency
      exchangeRate: $exchangeRate
      itemsTotalDiscount: $itemsTotalDiscount
      globalDiscount: $globalDiscount
      globalDiscountPercent: $globalDiscountPercent
      totalDiscount: $totalDiscount
      igvPercent: $igvPercent
      igvAmount: $igvAmount
      totalTaxable: $totalTaxable
      totalUnaffected: $totalUnaffected
      totalExempt: $totalExempt
      totalFree: $totalFree
      totalAmount: $totalAmount
      items: $items
      payments: $payments
      notes: $notes
      tableId: $tableId
      deviceId: $deviceId
      printerId: $printerId
    ) {
      success
      message
      wasCompleted
      wasTableFreed
      issuedDocument {
        id
        serial
        number
      }
      operation {
        id
        status
      }
      table {
        id
        status
        statusColors
        currentOperationId
        occupiedById
        userName
      }
    }
  }
`;

// Mutación para enviar mensaje broadcast
export const SEND_BROADCAST_MESSAGE = gql`
  mutation SendBroadcastMessage(
    $branchId: ID!
    $senderId: ID!
    $message: String!
    $recipients: String!
  ) {
    sendBroadcastMessage(
      branchId: $branchId
      senderId: $senderId
      message: $message
      recipients: $recipients
    ) {
      success
      message
      broadcastMessage {
        id
        message
        recipients
        createdAt
        sender {
          id
          fullName
        }
      }
    }
  }
`;

// Mutación para marcar mensaje broadcast como leído
export const MARK_MESSAGE_READ = gql`
  mutation MarkMessageRead($messageId: ID!) {
    markMessageRead(messageId: $messageId) {
      success
      message
    }
  }
`;

// Mutación para cambiar la mesa de una operación
export const CHANGE_OPERATION_TABLE = gql`
  mutation ChangeOperationTable($operationId: ID!, $newTableId: ID!, $branchId: ID!) {
    changeOperationTable(operationId: $operationId, newTableId: $newTableId, branchId: $branchId) {
      success
      message
      operation {
        id
        order
        status
      }
      oldTable {
        id
        name
        status
      }
      newTable {
        id
        name
        status
        occupiedById
        userName
        currentOperationId
      }
    }
  }
`;

// Mutación para cambiar el mozo de una operación
export const CHANGE_OPERATION_USER = gql`
  mutation ChangeOperationUser($operationId: ID!, $newUserId: ID!, $branchId: ID!) {
    changeOperationUser(operationId: $operationId, newUserId: $newUserId, branchId: $branchId) {
      success
      message
      operation {
        id
        order
        status
      }
      table {
        id
        name
        status
        occupiedById
        userName
        currentOperationId
      }
    }
  }
`;


// Mutación para transferir items (platos) entre mesas
export const TRANSFER_ITEMS = gql`
  mutation TransferItems($fromOperationId: ID!, $toTableId: ID!, $detailIds: [ID!]!, $branchId: ID!, $createNewOperation: Boolean) {
    transferItems(
      fromOperationId: $fromOperationId
      toTableId: $toTableId
      detailIds: $detailIds
      branchId: $branchId
      createNewOperation: $createNewOperation
    ) {
      success
      message
      fromOperation {
        id
        order
        status
        tableId 
        userId 
        branchId
        details{
          id 
          quantity
          unitMeasure
          unitValue
          unitPrice
          total
          notes 
          productId
          productName
          isPrepared
          isPrinted 
          isCanceled
        }
      }
      toOperation {
        id
        order
        status
        tableId
        userId
        branchId
        details{
          id 
          quantity
          unitMeasure
          unitPrice
          unitValue
          total
          notes
          productId
          productName
          isPrepared
          isPrinted
        }
      }
      oldTable {
        id
        name
        status
        occupiedById
        userName
        currentOperationId
      }
      newTable {
        id
        name
        status
        occupiedById
        userName
        currentOperationId
      }
    }
  }
`;

// Mutación para cancelar un detalle de operación
export const CANCEL_OPERATION_DETAIL = gql`
  mutation CancelOperationDetail($detailId: ID!, $quantity: Float, $userId: ID!, $deviceId: String) {
    cancelOperationDetail(detailId: $detailId, quantity: $quantity, userId: $userId, deviceId: $deviceId) {
      success
      message
      detail {
        id
        quantity
        isCanceled
      }
      operationCancelled
    }
  }
`;

// Mutación para cancelar una operación completa
export const CANCEL_OPERATION = gql`
  mutation CancelOperation(
    $operationId: ID!
    $branchId: ID!
    $userId: ID!
    $cancellationReason: String!
    $deviceId: String
  ) {
    cancelOperation(
      operationId: $operationId
      branchId: $branchId
      userId: $userId
      cancellationReason: $cancellationReason
      deviceId: $deviceId
    ) {
      success
      message
      operation {
        id
        order
        status
        cancelledAt
      }
      table {
        id
        name
        status
        statusColors
        currentOperationId
        occupiedById
        userName
      }
      stockMovementsCount
    }
  }
`;

// Mutación para imprimir precuenta (mismo nombre que Android: printAccount; no pedimos operation.status por enum REGISTER)
export const PRINT_PRECUENTA = gql`
  mutation PrintPrecuenta(
    $operationId: ID!
    $tableId: ID!
    $branchId: ID!
    $deviceId: String!
    $printerId: ID
  ) {
    printAccount(
      operationId: $operationId
      tableId: $tableId
      branchId: $branchId
      deviceId: $deviceId
      printerId: $printerId
    ) {
      success
      message
      operation {
        id
        total
      }
      table {
        id
        name
        status
        statusColors
      }
    }
  }
`;

// Mutación para imprimir precuenta parcial (solo items seleccionados)
export const PRINT_PARTIAL_PRECUENTA = gql`
  mutation PrintPartialPrecuenta(
    $operationId: ID!
    $detailIds: [ID!]!
    $tableId: ID!
    $branchId: ID!
    $userId: ID!
    $deviceId: String!
    $printerId: ID
  ) {
    printPartialPrecuenta(
      operationId: $operationId
      detailIds: $detailIds
      tableId: $tableId
      branchId: $branchId
      userId: $userId
      deviceId: $deviceId
      printerId: $printerId
    ) {
      success
      message
      operation {
        id
        order
      }
      table {
        id
        name
        status
        statusColors
        currentOperationId
        occupiedById
        userName
      }
    }
  }
`;

// Mutación para crear usuario/empleado
export const CREATE_USER = gql`
  mutation CreateUser(
    $dni: String!
    $email: String!
    $password: String!
    $firstName: String!
    $lastName: String!
    $branchId: ID!
    $role: String!
    $phone: String
    $photoBase64: String
  ) {
    createUser(
      dni: $dni
      email: $email
      password: $password
      firstName: $firstName
      lastName: $lastName
      branchId: $branchId
      role: $role
      phone: $phone
      photoBase64: $photoBase64
    ) {
      success
      message
      user {
        id
        dni
        email
        firstName
        lastName
        fullName
        role
        phone
        isActive
      }
    }
  }
`;

// Mutación para cerrar caja
export const CLOSE_CASH = gql`
  mutation CloseCash($userId: ID!, $branchId: ID!, $deviceId: ID!, $cashRegisterId: ID!) {
    closeCash(userId: $userId, branchId: $branchId, deviceId: $deviceId, cashRegisterId: $cashRegisterId) {
      success
      message
      closure {
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
      summary
    }
  }
`;

// Mutación para crear producto
export const CREATE_PRODUCT = gql`
  mutation CreateProduct(
    $branchId: ID!
    $code: String!
    $name: String!
    $productType: String!
    $salePrice: Float
    $purchasePrice: Float
    $unitMeasure: String
    $preparationTime: Int
    $currentStock: Float
    $stockMin: Float
    $stockMax: Float
    $description: String
    $subcategoryId: ID
    $imageBase64: String
  ) {
    createProduct(
      branchId: $branchId
      code: $code
      name: $name
      productType: $productType
      salePrice: $salePrice
      purchasePrice: $purchasePrice
      unitMeasure: $unitMeasure
      preparationTime: $preparationTime
      currentStock: $currentStock
      stockMin: $stockMin
      stockMax: $stockMax
      description: $description
      subcategoryId: $subcategoryId
      imageBase64: $imageBase64
    ) {
      success
      message
      product {
        id
        code
        name
        description
        productType
        salePrice
        purchasePrice
        unitMeasure
        preparationTime
        currentStock
        stockMin
        stockMax
        imageBase64
        isActive
        subcategoryId
      }
    }
  }
`;

// Mutación para actualizar producto
export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct(
    $productId: ID!
    $code: String
    $name: String
    $description: String
    $subcategoryId: ID
    $productType: String
    $salePrice: Float
    $purchasePrice: Float
    $unitMeasure: String
    $preparationTime: Int
    $stockMin: Float
    $stockMax: Float
    $currentStock: Float
    $isActive: Boolean
  ) {
    updateProduct(
      productId: $productId
      code: $code
      name: $name
      description: $description
      subcategoryId: $subcategoryId
      productType: $productType
      salePrice: $salePrice
      purchasePrice: $purchasePrice
      unitMeasure: $unitMeasure
      preparationTime: $preparationTime
      stockMin: $stockMin
      stockMax: $stockMax
      currentStock: $currentStock
      isActive: $isActive
    ) {
      success
      message
      product {
        id
        code
        name
        description
        salePrice
        preparationTime
        currentStock
        isActive
      }
    }
  }
`;

// Mutación para agregar ingrediente a una receta
export const ADD_RECIPE = gql`
  mutation AddRecipe(
    $productId: ID!
    $ingredientId: ID!
    $quantity: Float!
    $unitMeasure: String!
    $notes: String
  ) {
    addRecipe(
      productId: $productId
      ingredientId: $ingredientId
      quantity: $quantity
      unitMeasure: $unitMeasure
      notes: $notes
    ) {
      success
      message
      recipe {
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
  }
`;

// Mutación para eliminar ingrediente de una receta
export const REMOVE_RECIPE = gql`
  mutation RemoveRecipe($recipeId: ID!) {
    removeRecipe(recipeId: $recipeId) {
      success
      message
    }
  }
`;

// Mutación para crear operación de compra
export const CREATE_PURCHASE_OPERATION = gql`
  mutation CreatePurchaseOperation(
    $branchId: ID!
    $personId: ID
    $userId: ID!
    $operationDate: String
    $notes: String
    $details: [OperationDetailInput!]!
    $payments: [PaymentInput!]!
    $subtotal: Float
    $igvAmount: Float
    $igvPercentage: Float
    $total: Float
  ) {
    createPurchaseOperation(
      branchId: $branchId
      personId: $personId
      userId: $userId
      operationDate: $operationDate
      notes: $notes
      details: $details
      payments: $payments
      subtotal: $subtotal
      igvAmount: $igvAmount
      igvPercentage: $igvPercentage
      total: $total
    ) {
      success
      message
      operation {
        id
        order
        operationDate
        status
        subtotal
        igvAmount
        igvPercentage
        total
        notes
        person {
          id
          name
        }
        user {
          id
          fullName
        }
      }
      stockMovementsCount
    }
  }
`;

// Mutación para cancelar operación de compra
export const CANCEL_PURCHASE_OPERATION = gql`
  mutation CancelPurchaseOperation(
    $operationId: ID!
    $branchId: ID!
    $userId: ID!
    $cancellationReason: String!
  ) {
    cancelPurchaseOperation(
      operationId: $operationId
      branchId: $branchId
      userId: $userId
      cancellationReason: $cancellationReason
    ) {
      success
      message
      operation {
        id
        order
        status
        cancelledAt
      }
      stockMovementsCount
    }
  }
`;

// Mutación para crear persona (cliente o proveedor)
export const CREATE_PERSON = gql`
  mutation CreatePerson(
    $branchId: ID!
    $documentType: String!
    $documentNumber: String!
    $name: String!
    $address: String
    $phone: String
    $email: String
    $isCustomer: Boolean
    $isSupplier: Boolean
  ) {
    createPerson(
      branchId: $branchId
      documentType: $documentType
      documentNumber: $documentNumber
      name: $name
      address: $address
      phone: $phone
      email: $email
      isCustomer: $isCustomer
      isSupplier: $isSupplier
    ) {
      success
      message
      person {
        id
        name
        documentType
        documentNumber
        email
        phone
        address
        isCustomer
        isSupplier
        isActive
      }
    }
  }
`;

// Mutación para crear subcategoría
export const CREATE_SUBCATEGORY = gql`
  mutation CreateSubcategory(
    $categoryId: ID!
    $name: String!
    $description: String
    $order: Int
    $isActive: Boolean
  ) {
    createSubcategory(
      categoryId: $categoryId
      name: $name
      description: $description
      order: $order
      isActive: $isActive
    ) {
      success
      message
      subcategory {
        id
        name
        description
        order
        isActive
        category {
          id
          name
        }
      }
    }
  }
`;

// Mutación para crear modificador (observación)
export const CREATE_MODIFIER = gql`
  mutation CreateModifier(
    $subcategoryId: ID!
    $note: String!
    $isActive: Boolean
  ) {
    createModifier(
      subcategoryId: $subcategoryId
      note: $note
      isActive: $isActive
    ) {
      success
      message
      modifier {
        id
        note
        isActive
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
  }
`;

// Mutación para cancelar documento emitido (boleta/factura)
export const CANCEL_ISSUED_DOCUMENT = gql`
  mutation CancelIssuedDocument(
    $issuedDocumentId: ID!
    $userId: ID!
    $cancellationReason: String!
    $cancellationDescription: String
  ) {
    cancelIssuedDocument(
      issuedDocumentId: $issuedDocumentId
      userId: $userId
      cancellationReason: $cancellationReason
      cancellationDescription: $cancellationDescription
    ) {
      success
      message
      issuedDocument {
        id
        serial
        number
        billingStatus
        cancellationReason
        cancellationDescription
        cancellationDate
      }
    }
  }
`;

// Mutación para reimprimir documento (camelCase - por si el schema usa camelCase)
export const REPRINT_DOCUMENT = gql`
  mutation ReprintDocument(
    $operationId: ID
    $issuedDocumentId: ID
    $documentType: String!
    $deviceId: String!
  ) {
    reprintDocument(
      operationId: $operationId
      issuedDocumentId: $issuedDocumentId
      documentType: $documentType
      deviceId: $deviceId
    ) {
      success
      message
    }
  }
`;

// Mutación para crear transacción manual (Ingreso/Egreso)
export const CREATE_MANUAL_TRANSACTION = gql`
  mutation CreateManualTransaction(
    $cashRegisterId: ID!
    $transactionType: String!
    $payments: [PaymentInput!]!
    $notes: String
    $userId: ID!
    $branchId: ID!
  ) {
    createManualTransaction(
      cashRegisterId: $cashRegisterId
      transactionType: $transactionType
      payments: $payments
      notes: $notes
      userId: $userId
      branchId: $branchId
    ) {
      success
      message
      payments {
        id
        paymentType
        paymentMethod
        totalAmount
        paidAmount
        transactionType
        status
        paymentDate
        notes 
        dueDate 
        referenceNumber
        cashRegister{
          id
        }
      }
    }
  }
`;

// Mutación para crear Factura o Boleta desde documento anulado
export const CREATE_ISSUED_DOCUMENT_FROM_ANNULLED = gql`
  mutation CreateIssuedDocumentFromAnnulled(
    $parentIssuedDocumentId: ID!
    $branchId: ID!
    $documentId: ID!
    $serial: String!
    $personId: ID
    $userId: ID!
    $emissionDate: Date!
    $emissionTime: Time!
    $currency: String!
    $exchangeRate: Float!
    $itemsTotalDiscount: Float!
    $globalDiscount: Float!
    $globalDiscountPercent: Float!
    $totalDiscount: Float!
    $igvPercent: Float!
    $igvAmount: Float!
    $totalTaxable: Float!
    $totalUnaffected: Float!
    $totalExempt: Float!
    $totalFree: Float!
    $totalAmount: Float!
    $items: [IssuedDocumentItemInput!]!
    $notes: String
    $deviceId: String
    $printerId: ID
  ) {
    createIssuedDocumentFromAnnulled(
      parentIssuedDocumentId: $parentIssuedDocumentId
      branchId: $branchId
      documentId: $documentId
      serial: $serial
      personId: $personId
      userId: $userId
      emissionDate: $emissionDate
      emissionTime: $emissionTime
      currency: $currency
      exchangeRate: $exchangeRate
      itemsTotalDiscount: $itemsTotalDiscount
      globalDiscount: $globalDiscount
      globalDiscountPercent: $globalDiscountPercent
      totalDiscount: $totalDiscount
      igvPercent: $igvPercent
      igvAmount: $igvAmount
      totalTaxable: $totalTaxable
      totalUnaffected: $totalUnaffected
      totalExempt: $totalExempt
      totalFree: $totalFree
      totalAmount: $totalAmount
      items: $items
      notes: $notes
      deviceId: $deviceId
      printerId: $printerId
    ) {
      success
      message
      issuedDocument {
        id
        serial
        number
        billingStatus
      }
    }
  }
`;

// Mutación para reimprimir cierre de caja
export const REPRINT_CLOSURE = gql`
  mutation ReprintClosure($closureId: ID!, $deviceId: String!) {
    reprintClosure(closureId: $closureId, deviceId: $deviceId) {
      success
      message
    }
  }
`;

// Mutación para imprimir movimiento de caja (ingreso/egreso)
export const PRINT_PAYMENT = gql`
  mutation PrintPayment($paymentId: ID!, $deviceId: String!) {
    printPayment(paymentId: $paymentId, deviceId: $deviceId) {
      success
      message
    }
  }
`;