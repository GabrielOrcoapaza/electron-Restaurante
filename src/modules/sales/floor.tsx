import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';

// Query para obtener pisos de la sucursal
const GET_FLOORS_BY_BRANCH = gql`
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
const GET_TABLES_BY_FLOOR = gql`
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

const Floor: React.FC = () => {
  const { companyData } = useAuth();
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [showTables, setShowTables] = useState(false);

  // Obtener pisos de la sucursal
  const { data: floorsData, loading: floorsLoading, error: floorsError } = useQuery(GET_FLOORS_BY_BRANCH, {
    variables: { branchId: companyData?.branch.id },
    skip: !companyData?.branch.id
  });

  // Obtener mesas del piso seleccionado
  const { data: tablesData, loading: tablesLoading, error: tablesError } = useQuery(GET_TABLES_BY_FLOOR, {
    variables: { floorId: selectedFloorId },
    skip: !selectedFloorId
  });

  const handleFloorSelect = (floorId: string) => {
    setSelectedFloorId(floorId);
    setShowTables(true);
  };

  const handleBackToFloors = () => {
    setSelectedFloorId('');
    setShowTables(false);
  };

  if (floorsLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '1.125rem',
        color: '#718096'
      }}>
        Cargando pisos...
      </div>
    );
  }

  if (floorsError) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: '1.125rem',
        color: '#e53e3e'
      }}>
        Error al cargar los pisos: {floorsError.message}
      </div>
    );
  }

  if (!showTables) {
    return (
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#2d3748',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            Seleccionar Piso
          </h2>
          
          <p style={{
            fontSize: '1rem',
            color: '#718096',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            Elige un piso para ver sus mesas
          </p>

          {floorsData?.floorsByBranch?.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#718096'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
              <p style={{ fontSize: '1.125rem', margin: 0 }}>
                No hay pisos disponibles para esta sucursal
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem'
            }}>
              {floorsData?.floorsByBranch?.map((floor: any) => (
                <div
                  key={floor.id}
                  onClick={() => handleFloorSelect(floor.id)}
                  style={{
                    backgroundColor: '#f7fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.backgroundColor = '#f0f4ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    fontSize: '2.5rem',
                    marginBottom: '1rem'
                  }}>
                    🏢
                  </div>
                  
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#2d3748',
                    margin: '0 0 0.5rem 0'
                  }}>
                    {floor.name}
                  </h3>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    color: '#718096',
                    marginTop: '1rem'
                  }}>
                    <span>Capacidad: {floor.capacity}</span>
                    <span>Orden: {floor.order}</span>
                  </div>
                  
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    Piso {floor.order}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de mesas del piso seleccionado
  const selectedFloor = floorsData?.floorsByBranch?.find((floor: any) => floor.id === selectedFloorId);

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header con botón de regreso */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#2d3748',
              margin: 0
            }}>
              {selectedFloor?.name}
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#718096',
              margin: '0.25rem 0 0 0'
            }}>
              Mesas del piso
            </p>
          </div>
          
          <button
            onClick={handleBackToFloors}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#edf2f7';
              e.currentTarget.style.borderColor = '#cbd5e0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f7fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            ← Volver a pisos
          </button>
        </div>

        {/* Lista de mesas */}
        {tablesLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            fontSize: '1.125rem',
            color: '#718096'
          }}>
            Cargando mesas...
          </div>
        ) : tablesError ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            fontSize: '1.125rem',
            color: '#e53e3e'
          }}>
            Error al cargar las mesas: {tablesError.message}
          </div>
        ) : tablesData?.tablesByFloor?.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#718096'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🪑</div>
            <p style={{ fontSize: '1.125rem', margin: 0 }}>
              No hay mesas en este piso
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            {tablesData?.tablesByFloor?.map((table: any) => (
              <div
                key={table.id}
                style={{
                  backgroundColor: '#f7fafc',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.backgroundColor = '#f0f4ff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = '#f7fafc';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  fontSize: '2rem',
                  marginBottom: '0.75rem'
                }}>
                  {table.shape === 'CIRCLE' ? '⭕' : '🟦'}
                </div>
                
                <h4 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#2d3748',
                  margin: '0 0 0.5rem 0'
                }}>
                  {table.name}
                </h4>
                
                <div style={{
                  fontSize: '0.875rem',
                  color: '#718096',
                  marginBottom: '0.75rem'
                }}>
                  Capacidad: {table.capacity}
                </div>
                
                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  backgroundColor: table.status === 'AVAILABLE' ? '#c6f6d5' : 
                                 table.status === 'OCCUPIED' ? '#fed7d7' : '#fef5e7',
                  color: table.status === 'AVAILABLE' ? '#22543d' : 
                         table.status === 'OCCUPIED' ? '#742a2a' : '#744210'
                }}>
                  {table.status === 'AVAILABLE' ? 'Disponible' : 
                   table.status === 'OCCUPIED' ? 'Ocupada' : 'Reservada'}
                </div>
                
                {table.userName && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#718096',
                    marginTop: '0.5rem'
                  }}>
                    Ocupada por: {table.userName}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Floor;
