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
        email
      }
      branch {
        id
        name
        address
        users {
          id
          firstName
          lastName 
          dni
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

