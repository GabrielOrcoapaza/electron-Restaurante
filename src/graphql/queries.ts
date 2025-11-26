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
      operationDate
      details {
        id
        productId
        productCode
        productName
        productDescription
        quantity
        unitPrice
        total
        notes
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
      status
      statusColors
      currentOperationId
      occupiedById
      userName
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
      isActive
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
      isActive
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

