import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { GET_USER_SALES_REPORT, SEARCH_USERS } from '../../graphql/queries';
import ReportEmployeeList from './reportEmployeeList';

const SEARCH_DEBOUNCE_MS = 300;

export interface UserSaleOperation {
  id: string;
  order: string;
  operationDate: string;
  total: number;
  status: string;
  user: {
    id: string;
    fullName: string;
  };
}

export interface UserSalesSummary {
  totalOperations: number;
  grandTotal: number;
}

const ReportEmployee: React.FC = () => {
  const { companyData } = useAuth();
  const { breakpoint } = useResponsive();
  const branchId = companyData?.branch?.id;

  const isSmall = breakpoint === 'sm';
  const isMedium = breakpoint === 'md';
  const isSmallDesktop = breakpoint === 'lg';
  const isMediumDesktop = breakpoint === 'xl';

  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const containerGap = isSmall ? '1rem' : isMedium ? '1.5rem' : isSmallDesktop ? '1.5rem' : isMediumDesktop ? '2rem' : '2rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '1.5rem';
  const inputFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : isMediumDesktop ? '0.875rem' : '0.875rem';

  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [userId, setUserId] = useState<string>('');
  const [selectedUserLabel, setSelectedUserLabel] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: searchData } = useQuery(SEARCH_USERS, {
    variables: { branchId: branchId!, query: debouncedQuery },
    skip: !branchId || debouncedQuery.length < 2
  });

  const searchResults: Array<{ id: string; fullName: string; role?: string; dni?: string }> = searchData?.searchUsers ?? [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (u: { id: string; fullName: string; role?: string }) => {
    setUserId(u.id);
    setSelectedUserLabel(`${u.fullName}${u.role ? ` (${u.role})` : ''}`);
    setSearchInput('');
    setShowUserDropdown(false);
  };

  const handleClearUser = () => {
    setUserId('');
    setSelectedUserLabel('');
    setSearchInput('');
  };

  const { data, loading, error, refetch } = useQuery(GET_USER_SALES_REPORT, {
    variables: {
      branchId: branchId!,
      userId: userId || '',
      startDate,
      endDate
    },
    skip: !branchId || !userId || !startDate || !endDate,
    fetchPolicy: 'network-only'
  });

  const operations: UserSaleOperation[] = data?.userSalesReport?.operations ?? [];
  const summary: UserSalesSummary | null = data?.userSalesReport?.summary ?? null;

  const handleSearch = () => {
    refetch();
  };

  if (!branchId) {
    return (
      <div style={{
        padding: containerPadding,
        textAlign: 'center',
        color: '#dc2626',
        fontSize: subtitleFontSize
      }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: containerGap,
        background: 'linear-gradient(160deg, #fef3c7 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: isSmall ? '180px' : isMedium ? '220px' : isSmallDesktop ? '220px' : '260px',
          height: isSmall ? '180px' : isMedium ? '220px' : isSmallDesktop ? '220px' : '260px',
          background: 'radial-gradient(circle at center, rgba(245,158,11,0.2), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: isSmall ? '140px' : isMedium ? '180px' : isSmallDesktop ? '180px' : '220px',
          height: isSmall ? '140px' : isMedium ? '180px' : isSmallDesktop ? '180px' : '220px',
          background: 'radial-gradient(circle at center, rgba(251,191,36,0.15), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isSmall ? 'flex-start' : 'center',
          flexDirection: isSmall ? 'column' : 'row',
          marginBottom: containerGap,
          flexWrap: isSmall || isMedium ? 'wrap' : 'nowrap',
          gap: isSmall || isMedium ? '1rem' : '0'
        }}>
          <div>
            <h1 style={{ fontSize: titleFontSize, fontWeight: 700, color: '#1e293b', margin: 0, marginBottom: '0.5rem' }}>
              Reporte de Empleados
            </h1>
            <p style={{ fontSize: subtitleFontSize, color: '#64748b', margin: 0 }}>
              Ventas por empleado en el periodo
            </p>
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: cardPadding,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: containerGap
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: isSmall ? '1fr' : isMedium ? '1fr 1fr' : isSmallDesktop ? '1fr 1fr 1fr' : '1fr 1fr 1fr auto',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div style={{ position: 'relative' }} ref={userDropdownRef}>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Empleado
              </label>
              {userId ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: '#fffbeb',
                  fontSize: inputFontSize
                }}>
                  <span style={{ flex: 1, fontWeight: 500, color: '#1e293b' }}>{selectedUserLabel}</span>
                  <button
                    type="button"
                    onClick={handleClearUser}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#b45309',
                      background: 'transparent',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => debouncedQuery.length >= 2 && setShowUserDropdown(true)}
                    placeholder="Buscar por nombre, apellido o DNI..."
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      fontSize: inputFontSize,
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                  />
                  {showUserDropdown && debouncedQuery.length >= 2 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      zIndex: 50
                    }}>
                      {searchResults.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', fontSize: inputFontSize, color: '#64748b' }}>
                          No se encontraron empleados.
                        </div>
                      ) : (
                        searchResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleSelectUser(u)}
                            style={{
                              width: '100%',
                              padding: '0.625rem 1rem',
                              textAlign: 'left',
                              border: 'none',
                              background: 'transparent',
                              fontSize: inputFontSize,
                              cursor: 'pointer',
                              color: '#334155'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>{u.fullName}</span>
                            {u.role && <span style={{ color: '#64748b', marginLeft: '0.25rem' }}>({u.role})</span>}
                            {u.dni && <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.75rem' }}>DNI {u.dni}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  fontSize: inputFontSize,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: inputFontSize,
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  fontSize: inputFontSize,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={!userId}
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: buttonFontSize,
                fontWeight: 600,
                color: 'white',
                background: userId
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : '#d1d5db',
                border: 'none',
                borderRadius: '8px',
                cursor: userId ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                height: '42px'
              }}
            >
              Buscar
            </button>
          </div>
        </div>

        <ReportEmployeeList
          operations={operations}
          summary={summary}
          loading={loading}
          error={error}
          isSmallDesktop={isSmallDesktop}
          isSmall={isSmall}
          isMedium={isMedium}
        />
      </div>
    </div>
  );
};

export default ReportEmployee;
