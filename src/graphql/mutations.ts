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