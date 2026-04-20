import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { GET_CATEGORY_SALES_REPORT, GET_CATEGORIES_BY_BRANCH } from '../../graphql/queries';
import ReportCategorySalesList from './reportCategorySalesList';
import type { CategorySalesGroup, CategorySalesSummary } from './reportCategorySalesList';
import { formatLocalDateYYYYMMDD } from '../../utils/localDateTime';

function mapReport(
  raw: Record<string, unknown> | null | undefined
): { categories: CategorySalesGroup[]; summary: CategorySalesSummary | null } {
  if (!raw) return { categories: [], summary: null };
  const categoriesRaw = (raw.categories as Record<string, unknown>[]) ?? [];
  const categories: CategorySalesGroup[] = categoriesRaw.map((c) => ({
    categoryId: String(c.categoryId ?? (c as { category_id?: string }).category_id ?? ''),
    categoryName: String(c.categoryName ?? (c as { category_name?: string }).category_name ?? ''),
    categoryOrder: Number(c.categoryOrder ?? (c as { category_order?: number }).category_order ?? 0),
    totalQuantity: Number(c.totalQuantity ?? (c as { total_quantity?: number }).total_quantity ?? 0),
    totalAmount: Number(c.totalAmount ?? (c as { total_amount?: unknown }).total_amount ?? 0),
    products: ((c.products as Record<string, unknown>[]) ?? []).map((p) => ({
      productId: String(p.productId ?? (p as { product_id?: string }).product_id ?? ''),
      code: String(p.code ?? ''),
      name: String(p.name ?? ''),
      totalQuantity: Number(p.totalQuantity ?? (p as { total_quantity?: number }).total_quantity ?? 0),
      totalAmount: Number(p.totalAmount ?? (p as { total_amount?: unknown }).total_amount ?? 0),
    })),
  }));
  const s = (raw.summary as Record<string, unknown>) ?? (raw as { summary?: Record<string, unknown> }).summary;
  const summary: CategorySalesSummary | null = s
    ? {
        grandTotalQuantity: Number(
          s.grandTotalQuantity ?? (s as { grand_total_quantity?: number }).grand_total_quantity ?? 0
        ),
        grandTotalAmount: Number(s.grandTotalAmount ?? (s as { grand_total_amount?: unknown }).grand_total_amount ?? 0),
      }
    : null;
  return { categories, summary };
}

const ReportCategorySales: React.FC = () => {
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

  const [startDate, setStartDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(() => formatLocalDateYYYYMMDD());
  const [categoryId, setCategoryId] = useState<string>('');

  const { data: categoriesMeta } = useQuery(GET_CATEGORIES_BY_BRANCH, {
    variables: { branchId: branchId! },
    skip: !branchId,
    fetchPolicy: 'cache-first',
  });
  const categoryOptions = useMemo(() => {
    const list = categoriesMeta?.categoriesByBranch ?? [];
    return list.filter((c: { isActive?: boolean }) => c.isActive !== false);
  }, [categoriesMeta?.categoriesByBranch]);

  const { data, loading, error, refetch } = useQuery(GET_CATEGORY_SALES_REPORT, {
    variables: {
      branchId: branchId!,
      startDate,
      endDate,
      categoryId: categoryId || null,
    },
    skip: !branchId || !startDate || !endDate,
    fetchPolicy: 'network-only',
  });

  const root =
    (data as { categorySalesReport?: Record<string, unknown>; category_sales_report?: Record<string, unknown> } | undefined)
      ?.categorySalesReport ??
    (data as { category_sales_report?: Record<string, unknown> } | undefined)?.category_sales_report;
  const { categories, summary } = mapReport(root);

  const handleSearch = () => {
    refetch();
  };

  if (!branchId) {
    return (
      <div
        style={{
          padding: containerPadding,
          textAlign: 'center',
          color: '#dc2626',
          fontSize: subtitleFontSize,
        }}
      >
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
        background: 'linear-gradient(160deg, #eff6ff 0%, #f9fafb 45%, #ffffff 100%)',
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
          background: 'radial-gradient(circle at center, rgba(59,130,246,0.2), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isSmall ? 'flex-start' : 'center',
            flexDirection: isSmall ? 'column' : 'row',
            marginBottom: containerGap,
            flexWrap: isSmall || isMedium ? 'wrap' : 'nowrap',
            gap: isSmall || isMedium ? '1rem' : '0',
          }}
        >
          <div>
            <h1 style={{ fontSize: titleFontSize, fontWeight: 700, color: '#1e293b', margin: 0, marginBottom: '0.5rem' }}>
              Ventas por categoría
            </h1>
            <p style={{ fontSize: subtitleFontSize, color: '#64748b', margin: 0 }}>
              Platos y bebidas facturados en documentos emitidos (no anulados), agrupados por categoría
            </p>
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: cardPadding,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: containerGap,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isSmall ? '1fr' : isMedium ? '1fr 1fr' : isSmallDesktop ? '1fr 1fr 1fr' : '1fr 1fr 1fr auto',
              gap: '1rem',
              alignItems: 'end',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: inputFontSize,
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem',
                }}
              >
                Fecha inicio
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
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: inputFontSize,
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem',
                }}
              >
                Fecha fin
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
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: inputFontSize,
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem',
                }}
              >
                Categoría (opcional)
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  fontSize: inputFontSize,
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                }}
              >
                <option value="">Todas las categorías</option>
                {categoryOptions.map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleSearch}
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: buttonFontSize,
                fontWeight: 600,
                color: 'white',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                height: '42px',
              }}
            >
              Buscar
            </button>
          </div>
        </div>

        <ReportCategorySalesList
          categories={categories}
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

export default ReportCategorySales;
