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
      }
      toOperation {
        id
        order
        status
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
  mutation CancelOperationDetail($detailId: ID!, $quantity: Float, $userId: ID) {
    cancelOperationDetail(detailId: $detailId, quantity: $quantity, userId: $userId) {
      success
      message
      detail {
        id
        quantity
        isCanceled
      }
    }
  }
`;

