import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useToast } from '../../context/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import {
  GET_CASH_REGISTERS,
  GET_CASH_CLOSURE_PREVIEW,
  GET_CASH_CLOSURES,
  GET_PAYMENTS_PENDING_CLOSURE
} from '../../graphql/queries';
import { CLOSE_CASH, REPRINT_CLOSURE, PRINT_PAYMENT, CANCEL_PAYMENT } from '../../graphql/mutations';
import ManualTransactionModal from './manualTransactionModal';
import CashDetailModal, { type CashClosureForDetail } from './cashDetailModal';

interface CashRegister {
  id: string;
  name: string;
  cashType: string;
  currentBalance: number;
  isActive: boolean;
}

interface UserSummary {
  userId: string;
  userName: string;
  userRole: string;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  paymentsCount: number;
  operationsCount: number;
  dishesCount: number;
  hasOccupiedTables: boolean;
  occupiedTablesCount: number;
  occupiedTablesNames: string[];
  canClose: boolean;
  paymentMethods: PaymentMethodDetail[];
}

interface PaymentMethodDetail {
  methodCode: string;
  methodName: string;
  income: number;
  expense: number;
  net: number;
}

interface ClosureWarning {
  type: string;
  message: string;
}

interface CashClosurePreview {
  branchId: string;
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  nextClosureNumber: number;
  totalPaymentsPending: number;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  canClose: boolean;
  previewDate: string;
  usersSummary: UserSummary[];
  generalPaymentMethods: PaymentMethodDetail[];
  warnings: ClosureWarning[];
}

interface CashClosure {
  id: string;
  closureNumber: number;
  closedAt: string;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
  cashRegister: {
    id: string;
    name: string;
    cashType: string;
  };
  branch: {
    id: string;
    name: string;
  };
}

interface PaymentMovement {
  id: string;
  paymentDate: string;
  paidAmount: number;
  totalAmount?: number;
  transactionType: string;
  paymentMethod: string;
  status: string;
  notes?: string;
  user?: { id: string; fullName: string };
  operation?: { id: string; order?: string };
  issuedDocument?: { id: string; serial?: string; number?: string };
}

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
});

const Cashs: React.FC = () => {
  const apolloClient = useApolloClient();
  const { companyData, user, getMacAddress } = useAuth();
  const { hasPermission } = useUserPermissions();
  const { showToast } = useToast();
  const { breakpoint, isMobile, isTablet } = useResponsive();
  const branchId = companyData?.branch?.id;

  // Adaptar según tamaño de pantalla (sm, md, lg, xl, 2xl - excluye xs/móvil)
  const isSmall = breakpoint === 'sm'; // 640px - 767px
  const isMedium = breakpoint === 'md'; // 768px - 1023px
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  const isMediumDesktop = breakpoint === 'xl'; // 1280px - 1535px

  // Tamaños adaptativos
  const containerPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : isMediumDesktop ? '1.5rem' : '2rem';
  const cardPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : '1.5rem';
  const titleFontSize = isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.375rem' : isMediumDesktop ? '1.5rem' : '1.75rem';
  const subtitleFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : '0.875rem';
  const sectionTitleFontSize = isSmall ? '0.9375rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.125rem';
  const gridGap = isSmall ? '0.75rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.5rem';
  const statCardMinWidth = isSmall ? '160px' : isMedium ? '180px' : isSmallDesktop ? '180px' : isMediumDesktop ? '200px' : '220px';
  const cashCardMinWidth = isSmall ? '240px' : isMedium ? '260px' : isSmallDesktop ? '280px' : isMediumDesktop ? '300px' : '320px';
  const buttonPadding = isSmall ? '0.5rem 0.875rem' : isMedium ? '0.5rem 1rem' : isSmallDesktop ? '0.5rem 1rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmall ? '0.75rem' : isMedium ? '0.8125rem' : isSmallDesktop ? '0.8125rem' : '0.875rem';

  const [selectedCashRegister, setSelectedCashRegister] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showManualTransactionModal, setShowManualTransactionModal] = useState(false);
  const [salesTotalsByRegister, setSalesTotalsByRegister] = useState<Record<string, number>>({});
  // Filtro de fechas para historial de cierres (YYYY-MM-DD; vacío = sin filtro)
  const [closureFilterStart, setClosureFilterStart] = useState<string>('');
  const [closureFilterEnd, setClosureFilterEnd] = useState<string>('');
  // Mostrar/ocultar bloque de cajas en gestión de cajas
  const [summaryVisible, setSummaryVisible] = useState<{ cajas: boolean }>({
    cajas: true
  });
  // Mostrar/ocultar movimientos de caja en el preview
  const [showMovements, setShowMovements] = useState(false);
  // Mostrar/ocultar totales generales en el preview
  const [showTotalesGenerales, setShowTotalesGenerales] = useState(true);
  // Modal de detalle de cierre (al hacer clic en una fila del historial)
  const [selectedClosureForDetail, setSelectedClosureForDetail] = useState<CashClosureForDetail | null>(null);

  const roleUpper = (user?.role || '').toUpperCase();
  const isAdminUser = roleUpper === 'ADMIN';
  const canCloseCashRegister = isAdminUser || hasPermission('sales.close');
  const canRegisterManualMovements =
    isAdminUser || hasPermission('cash.register_movements') || canCloseCashRegister;
  const canChangeManualPaymentMethod =
    isAdminUser || hasPermission('cash.change_payment_method') || canCloseCashRegister;
  const canVoidManualMovementInList =
    isAdminUser ||
    hasPermission('cash.view') ||
    hasPermission('cash.void') ||
    canCloseCashRegister;
  const canOpenClosePreview = canCloseCashRegister || canRegisterManualMovements;

  // Query para obtener cajas
  const { data: cashRegistersData, loading: cashRegistersLoading, refetch: refetchCashRegisters } = useQuery(
    GET_CASH_REGISTERS,
    {
      variables: { branchId: branchId! },
      skip: !branchId,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener preview de cierre
  const { data: previewData, loading: previewLoading, refetch: refetchPreview } = useQuery(
    GET_CASH_CLOSURE_PREVIEW,
    {
      variables: {
        branchId: branchId!,
        cashRegisterId: selectedCashRegister,
        userId: selectedUserId
      },
      skip: !branchId || !selectedCashRegister || !showPreview,
      fetchPolicy: 'network-only'
    }
  );

  // Query para obtener historial de cierres (con filtro de fechas opcional)
  const { data: closuresData, loading: closuresLoading, error: closuresError, refetch: refetchClosures } = useQuery(
    GET_CASH_CLOSURES,
    {
      variables: {
        branchId: branchId!,
        userId: null,
        startDate: closureFilterStart || null,
        endDate: closureFilterEnd || null
      },
      skip: !branchId,
      fetchPolicy: 'network-only',
      onCompleted: (data) => {
        console.log('📜 Datos de cierres recibidos:', data);
        console.log('📜 Cierres:', data?.cashClosures);
      },
      onError: (error) => {
        console.error('❌ Error al cargar cierres:', error);
      }
    }
  );

  // Pagos pendientes: al abrir preview (total ventas sin manual) y para la tabla de movimientos
  const { data: movementsData, loading: movementsLoading, refetch: refetchMovements } = useQuery(GET_PAYMENTS_PENDING_CLOSURE, {
    variables: {
      cashRegisterId: selectedCashRegister,
      transactionType: null,
      paymentMethod: null
    },
    skip: !selectedCashRegister || !showPreview,
    fetchPolicy: 'network-only'
  });

  // Mutación para reimprimir cierre (usada al cerrar caja y para cierres anteriores)
  const [reprintClosureMutation, { loading: reprintingClosure }] = useMutation(REPRINT_CLOSURE);
  const [reprintingClosureId, setReprintingClosureId] = useState<string | null>(null);

  // Mutación para imprimir movimiento de caja individual
  const [printPaymentMutation] = useMutation(PRINT_PAYMENT);
  const [printingPaymentId, setPrintingPaymentId] = useState<string | null>(null);

  const [cancelPaymentMutation] = useMutation(CANCEL_PAYMENT);
  const [cancelingPaymentId, setCancelingPaymentId] = useState<string | null>(null);

  const handleReprintClosure = async (closure: CashClosure) => {
    try {
      const mac = await getMacAddress();
      if (!mac) {
        showToast('No se pudo obtener la MAC de la PC. Intenta de nuevo.', 'error');
        return;
      }
      setReprintingClosureId(closure.id);
      const result = await reprintClosureMutation({
        variables: { closureId: closure.id, deviceId: mac }
      });
      const data = result.data?.reprintClosure;
      if (data?.success) {
        if (data.printLocally && data.documentData) {
          try {
            const doc = typeof data.documentData === 'string' ? JSON.parse(data.documentData) : data.documentData;
            if (typeof (window as any).printClosureDocument === 'function') {
              (window as any).printClosureDocument(doc);
            }
          } catch (_) {
            // Sin impresora integrada: el backend ya pudo haber enviado a cola
          }
        }
        showToast(data.message || 'Reimpresión enviada', 'success');
      } else {
        showToast(data?.message || 'Error al reimprimir', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de conexión al reimprimir', 'error');
    } finally {
      setReprintingClosureId(null);
    }
  };

  const handlePrintPayment = async (paymentId: string) => {
    try {
      const mac = await getMacAddress();
      if (!mac) {
        showToast('No se pudo obtener la MAC de la PC. Intenta de nuevo.', 'error');
        return;
      }
      setPrintingPaymentId(paymentId);
      const result = await printPaymentMutation({
        variables: { paymentId, deviceId: mac }
      });
      const data = result.data?.printPayment;
      if (data?.success) {
        showToast(data.message || 'Impresión enviada', 'success');
      } else {
        showToast(data?.message || 'Error al imprimir', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error de conexión al imprimir', 'error');
    } finally {
      setPrintingPaymentId(null);
    }
  };

  const isCancelledCashMovement = (mov: PaymentMovement): boolean => {
    const s = String((mov as any).status ?? '').toUpperCase().replace(/\s/g, '_');
    return s === 'CANCELLED' || s === 'CANCELED';
  };

  /** Solo ingresos/egresos manuales (sin operación de compra/venta). El backend rechaza el resto. */
  const canCancelManualCashMovement = (mov: PaymentMovement): boolean => {
    if (isCancelledCashMovement(mov)) return false;
    const opId = mov.operation?.id ?? (mov as any).operation?.id;
    if (opId != null && opId !== '') return false;
    return true;
  };

  const handleCancelManualPayment = async (paymentId: string) => {
    if (
      !window.confirm(
        '¿Anular este movimiento manual? Se marcará como cancelado y se revertirá el saldo de la caja. No aplica a ventas ni compras.'
      )
    ) {
      return;
    }
    try {
      setCancelingPaymentId(paymentId);
      const result = await cancelPaymentMutation({ variables: { paymentId } });
      const data = result.data?.cancelPayment ?? (result.data as any)?.cancel_payment;
      if (data?.success) {
        showToast(data.message || 'Movimiento anulado', 'success');
        await refetchMovements();
        refetchPreview();
        refetchCashRegisters();
      } else {
        showToast(data?.message || 'No se pudo anular el movimiento', 'error');
      }
    } catch (err: any) {
      const gqlMsg = err?.graphQLErrors?.[0]?.message;
      showToast(gqlMsg || err?.message || 'Error al anular el movimiento', 'error');
    } finally {
      setCancelingPaymentId(null);
    }
  };

  // Mutación para cerrar caja
  const [closeCashMutation, { loading: closingCash }] = useMutation(CLOSE_CASH, {
    onCompleted: async (data) => {
      if (data?.closeCash?.success) {
        const summary = data.closeCash.summary;
        const closure = data.closeCash.closure;

        // Mostrar mensaje de éxito con información del cierre
        const message = data.closeCash.message || 'Caja cerrada exitosamente';

        // Construir mensaje detallado
        let detailMessage = message;
        if (closure) {
          detailMessage += `\n\n📊 Resumen del Cierre #${closure.closureNumber}:`;
          detailMessage += `\n• Total Ingresos: ${currencyFormatter.format(closure.totalIncome)}`;
          detailMessage += `\n• Total Egresos: ${currencyFormatter.format(closure.totalExpense)}`;
          detailMessage += `\n• Neto Total: ${currencyFormatter.format(closure.netTotal)}`;

          // Imprimir solo si el backend devolvió datos para impresión local (evita doble impresión).
          // Si no devolvió printLocally/documentData, el backend ya encoló la impresión (Raspberry).
          const printLocally = data.closeCash.printLocally && data.closeCash.documentData;
          if (printLocally) {
            try {
              const doc = typeof data.closeCash.documentData === 'string'
                ? JSON.parse(data.closeCash.documentData)
                : data.closeCash.documentData;
              if (typeof (window as any).printClosureDocument === 'function') {
                (window as any).printClosureDocument(doc);
                console.log('✅ Cierre impreso en local');
              }
            } catch (printError) {
              console.error('❌ Error al imprimir cierre en local:', printError);
            }
          } else {
            console.log('✅ Cierre realizado (impresión encolada en servidor o no requerida)');
          }
        }
        console.log(detailMessage);

        // Si hay summary, mostrar información adicional en consola
        if (summary) {
          try {
            const summaryData = typeof summary === 'string' ? JSON.parse(summary) : summary;
            console.log('📊 Resumen completo del cierre:', summaryData);
          } catch (e) {
            console.log('📊 Resumen del cierre:', summary);
          }
        }

        // Limpiar estado y refrescar datos
        setShowPreview(false);
        setSelectedCashRegister('');
        setSelectedUserId(null);
        setShowMovements(false);
        setShowTotalesGenerales(true);

        // Refrescar todas las queries relacionadas
        refetchCashRegisters();
        refetchClosures();
      } else {
        const errorMessage = data?.closeCash?.message || 'No se pudo cerrar la caja';
        alert(`❌ Error: ${errorMessage}`);
      }
    },
    onError: (error) => {
      console.error('❌ Error al cerrar la caja:', error);
      const errorMessage = error.message || 'Ocurrió un error al intentar cerrar la caja';
      alert(`❌ Error al cerrar la caja: ${errorMessage}`);
    }
  });

  const cashRegisters: CashRegister[] = cashRegistersData?.cashRegistersByBranch || [];
  const preview: CashClosurePreview | null = previewData?.cashClosurePreview || null;
  // Intentar ambos nombres por si hay diferencia entre snake_case y camelCase
  const closures: CashClosure[] = closuresData?.cashClosures || closuresData?.cash_closures || [];
  const movements: PaymentMovement[] = movementsData?.paymentsPendingClosure || movementsData?.payments_pending_closure || [];

  /** Suma cobros ligados a ventas (tienen operación); excluye ingresos/egresos manuales y anulados. */
  const totalVentasSinManual = useMemo(() => {
    let total = 0;
    for (const mov of movements) {
      if (isCancelledCashMovement(mov)) continue;
      const opId = mov.operation?.id ?? (mov as any).operation?.id;
      if (opId == null || opId === '') continue;
      const amount = Number((mov as any).paidAmount ?? (mov as any).paid_amount ?? mov.paidAmount ?? 0);
      const type = String((mov as any).transactionType ?? (mov as any).transaction_type ?? mov.transactionType ?? '').toUpperCase();
      if (type === 'INCOME') total += amount;
      else if (type === 'EXPENSE') total -= amount;
    }
    return Math.round(total * 100) / 100;
  }, [movements]);

  // Obtiene el total vendido acumulado por cada caja usando el preview de cierre.
  useEffect(() => {
    let cancelled = false;

    const loadSalesTotals = async () => {
      if (!branchId || cashRegisters.length === 0) {
        setSalesTotalsByRegister({});
        return;
      }

      try {
        const entries = await Promise.all(
          cashRegisters.map(async (cashRegister) => {
            try {
              const { data } = await apolloClient.query({
                query: GET_CASH_CLOSURE_PREVIEW,
                variables: {
                  branchId,
                  cashRegisterId: cashRegister.id,
                  userId: null
                },
                fetchPolicy: 'network-only'
              });

              return [cashRegister.id, Number(data?.cashClosurePreview?.totalIncome ?? 0)] as const;
            } catch {
              return [cashRegister.id, Number(cashRegister.currentBalance ?? 0)] as const;
            }
          })
        );

        if (!cancelled) {
          setSalesTotalsByRegister(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          const fallbackEntries = cashRegisters.map((cashRegister) => [
            cashRegister.id,
            Number(cashRegister.currentBalance ?? 0)
          ] as const);
          setSalesTotalsByRegister(Object.fromEntries(fallbackEntries));
        }
      }
    };

    loadSalesTotals();

    return () => {
      cancelled = true;
    };
  }, [apolloClient, branchId, cashRegisters]);

  // Debug: Log para verificar datos de cierres
  useEffect(() => {
    if (closuresData) {
      console.log('📜 closuresData completo:', closuresData);
      console.log('📜 cashClosures:', closuresData.cashClosures);
      console.log('📜 cash_closures:', closuresData.cash_closures);
      console.log('📜 closures array:', closures);
    }
    if (closuresError) {
      console.error('❌ Error en query de cierres:', closuresError);
    }
  }, [closuresData, closuresError, closures]);

  const getCashTypeLabel = (type: string) => {
    switch (type) {
      case 'CASH': return 'Efectivo';
      case 'DIGITAL': return 'Digital';
      case 'BANK': return 'Bancario';
      default: return type;
    }
  };

  const getCashTypeColor = (type: string) => {
    switch (type) {
      case 'CASH': return { bg: '#dcfce7', color: '#166534', border: '#86efac' };
      case 'DIGITAL': return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
      case 'BANK': return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      default: return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: 'Efectivo',
      YAPE: 'Yape',
      PLIN: 'Plin',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      OTROS: 'Otros'
    };
    return labels[method] || method;
  };

  /** Mismos colores que el reporte de ventas (`reportSale.tsx` → Totales por Método de Pago). */
  const getPaymentMethodCardTheme = (methodCode: string) => {
    const code = (methodCode || '').toUpperCase();
    const themes: Record<string, { color: string; bg: string; border: string }> = {
      CASH: { color: '#0369a1', bg: '#f0f9ff', border: '#0ea5e9' },
      YAPE: { color: '#047857', bg: '#f0fdf4', border: '#10b981' },
      PLIN: { color: '#b45309', bg: '#fef3c7', border: '#f59e0b' },
      CARD: { color: '#b91c1c', bg: '#fef2f2', border: '#ef4444' },
      TRANSFER: { color: '#7e22ce', bg: '#f3e8ff', border: '#a855f7' },
      OTROS: { color: '#334155', bg: '#f1f5f9', border: '#64748b' }
    };
    return themes[code] ?? { color: '#334155', bg: '#f1f5f9', border: '#64748b' };
  };

  const getTransactionTypeLabel = (type: string) => {
    return type === 'INCOME' ? 'Ingreso' : type === 'EXPENSE' ? 'Egreso' : type;
  };

  const handleShowPreview = (cashRegisterId: string) => {
    if (!canOpenClosePreview) {
      showToast('No tienes permiso para abrir el detalle de caja.', 'error');
      return;
    }
    setSelectedCashRegister(cashRegisterId);
    setShowPreview(true);
    setShowHistory(false);
  };

  const handleCloseCashClick = () => {
    if (!canCloseCashRegister) {
      showToast('No tienes permiso para cerrar caja.', 'error');
      return;
    }
    if (!selectedCashRegister || !branchId || !user?.id) {
      alert('❌ Por favor selecciona una caja y verifica que estés autenticado');
      return;
    }

    if (!preview?.canClose) {
      alert('❌ No se puede cerrar la caja. Revisa las advertencias.');
      return;
    }

    // Mostrar modal de confirmación
    setShowConfirmModal(true);
  };

  const handleConfirmCloseCash = async () => {
    setShowConfirmModal(false);

    if (!canCloseCashRegister) {
      showToast('No tienes permiso para cerrar caja.', 'error');
      return;
    }

    if (!selectedCashRegister || !branchId || !user?.id) {
      return;
    }

    try {
      const mac = await getMacAddress();
      if (!mac) {
        showToast('No se pudo obtener la MAC de la PC. Intenta nuevamente.', 'error');
        return;
      }

      await closeCashMutation({
        variables: {
          userId: user.id,
          branchId: branchId,
          deviceId: mac,
          cashRegisterId: selectedCashRegister
        }
      });
    } catch (error) {
      console.error('Error al cerrar caja:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Mostrar mensaje si es móvil o tablet
  if (isMobile || isTablet) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#dc2626',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📱</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
          No disponible en dispositivos móviles
        </h2>
        <p style={{ fontSize: '1rem', color: '#64748b', maxWidth: '400px' }}>
          Esta funcionalidad está optimizada para pantallas de escritorio. Por favor, accede desde una computadora o tableta en modo horizontal.
        </p>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div style={{ padding: containerPadding, textAlign: 'center', color: '#dc2626' }}>
        No se encontró información de la sucursal. Por favor, inicia sesión nuevamente.
      </div>
    );
  }

  return (
    <div style={{ padding: containerPadding, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: cardPadding,
        marginBottom: gridGap,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: titleFontSize, fontWeight: 700, color: '#1e293b' }}>
          💰 Gestión de Cajas
        </h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setShowPreview(false);
              setShowHistory(false);
              setSelectedCashRegister('');
              setShowMovements(false);
              setShowTotalesGenerales(true);
            }}
            style={{
              padding: buttonPadding,
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: showPreview || showHistory ? 'white' : '#3b82f6',
              color: showPreview || showHistory ? '#64748b' : 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: buttonFontSize,
              transition: 'all 0.2s'
            }}
          >
            Cajas
          </button>
          {canCloseCashRegister && (
            <button
              onClick={() => {
                setShowHistory(true);
                setShowPreview(false);
              }}
              style={{
                padding: buttonPadding,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: showHistory ? '#3b82f6' : 'white',
                color: showHistory ? 'white' : '#64748b',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: buttonFontSize,
                transition: 'all 0.2s'
              }}
            >
              Historial de Cierres
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!canRegisterManualMovements) {
                showToast('No tienes permiso para registrar ingresos o egresos manuales.', 'error');
                return;
              }
              setShowManualTransactionModal(true);
            }}
            disabled={!canRegisterManualMovements}
            style={{
              padding: buttonPadding,
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: canRegisterManualMovements ? 'white' : '#f1f5f9',
              color: canRegisterManualMovements ? '#64748b' : '#94a3b8',
              cursor: canRegisterManualMovements ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: buttonFontSize,
              transition: 'all 0.2s',
              opacity: canRegisterManualMovements ? 1 : 0.85
            }}
            onMouseEnter={(e) => {
              if (!canRegisterManualMovements) return;
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#1e293b';
            }}
            onMouseLeave={(e) => {
              if (!canRegisterManualMovements) return;
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = '#64748b';
            }}
            title={!canRegisterManualMovements ? 'Requiere permiso: registrar movimientos en caja o cierre de caja' : undefined}
          >
            ➕ Ingreso/Egreso
          </button>
        </div>
      </div>

      {/* Vista de Cajas */}
      {!showPreview && !showHistory && (
        <>
          {/* Lista de Cajas */}
          {cashRegistersLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Cargando cajas...
            </div>
          ) : (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: summaryVisible.cajas ? '1rem' : 0 }}>
                <h3 style={{ margin: 0, fontSize: sectionTitleFontSize, fontWeight: 600, color: '#334155' }}>
                  🏪 Cajas Registradoras ({cashRegisters.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setSummaryVisible((v) => ({ ...v, cajas: !v.cajas }))}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {summaryVisible.cajas ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {summaryVisible.cajas && (
                <>
                  {cashRegisters.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: isSmall ? '1.5rem' : isMedium ? '2rem' : isSmallDesktop ? '2rem' : '3rem',
                      color: '#64748b'
                    }}>
                      <p style={{ fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', margin: 0 }}>No hay cajas registradas</p>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fill, minmax(${cashCardMinWidth}, 1fr))`,
                      gap: gridGap
                    }}>
                      {cashRegisters.map((cashRegister) => {
                        const typeColors = getCashTypeColor(cashRegister.cashType);
                        return (
                          <div
                            key={cashRegister.id}
                            style={{
                              padding: cardPadding,
                              borderRadius: '12px',
                              border: `2px solid ${typeColors.border}`,
                              backgroundColor: typeColors.bg,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                            }}
                            onClick={() => handleShowPreview(cashRegister.id)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem', fontSize: isSmall ? '0.9375rem' : isMedium ? '1rem' : isSmallDesktop ? '1rem' : '1.125rem', fontWeight: 700, color: typeColors.color }}>
                                  {cashRegister.name}
                                </h4>
                                <span style={{
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: 'white',
                                  color: typeColors.color,
                                  display: 'inline-block'
                                }}>
                                  {getCashTypeLabel(cashRegister.cashType)}
                                </span>
                              </div>
                            </div>
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${typeColors.border}` }}>
                              <div style={{ fontSize: '0.875rem', color: typeColors.color, marginBottom: '0.5rem' }}>
                                Total vendido (hasta ahora)
                              </div>
                              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: typeColors.color }}>
                                {currencyFormatter.format(salesTotalsByRegister[cashRegister.id] ?? cashRegister.currentBalance)}
                              </div>
                            </div>
                            {canOpenClosePreview && (
                              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  style={{
                                    padding: buttonPadding,
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: typeColors.color,
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: buttonFontSize,
                                    width: '100%'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowPreview(cashRegister.id);
                                  }}
                                >
                                  {canCloseCashRegister ? 'Ver Detalles / Cerrar Caja' : 'Ver detalles y movimientos'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Vista de Preview de Cierre */}
      {showPreview && selectedCashRegister && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: isSmall ? '1rem' : isMedium ? '1.125rem' : isSmallDesktop ? '1.125rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
              🔍 Preview de Cierre de Caja
            </h3>
            <button
              onClick={() => {
                setShowPreview(false);
                setSelectedCashRegister('');
                setSelectedUserId(null);
                setShowMovements(false);
                setShowTotalesGenerales(true);
              }}
              style={{
                padding: buttonPadding,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                color: '#64748b',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: buttonFontSize
              }}
            >
              ← Volver
            </button>
          </div>

          {previewLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Cargando preview...
            </div>
          ) : preview ? (
            <>
              {/* Información General */}
              <div style={{
                padding: cardPadding,
                borderRadius: '12px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                marginBottom: gridGap
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`, gap: gridGap }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Caja</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{preview.cashRegisterName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>N° Cierre</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>#{preview.nextClosureNumber}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Pagos Pendientes</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{preview.totalPaymentsPending}</div>
                  </div>
                </div>
              </div>

              {/* Advertencias */}
              {preview.warnings && preview.warnings.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  {preview.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '0.5rem',
                        backgroundColor:
                          warning.type === 'ERROR' ? '#fef2f2' :
                            warning.type === 'WARNING' ? '#fffbeb' :
                              '#f0f9ff',
                        border: `1px solid ${warning.type === 'ERROR' ? '#fecaca' :
                          warning.type === 'WARNING' ? '#fde68a' :
                            '#bae6fd'
                          }`,
                        color:
                          warning.type === 'ERROR' ? '#991b1b' :
                            warning.type === 'WARNING' ? '#92400e' :
                              '#1e40af'
                      }}
                    >
                      <strong>{warning.type === 'ERROR' ? '❌' : warning.type === 'WARNING' ? '⚠️' : 'ℹ️'}</strong> {warning.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Totales Generales — mostrar/ocultar con botón */}
              <div style={{
                padding: cardPadding,
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: gridGap
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: showTotalesGenerales ? '1rem' : 0 }}>
                  <h4 style={{ margin: 0, fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                    Totales Generales
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTotalesGenerales((v) => !v)}
                    style={{
                      padding: buttonPadding,
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: showTotalesGenerales ? '#64748b' : '#3b82f6',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: buttonFontSize
                    }}
                  >
                    {showTotalesGenerales ? 'Ocultar' : 'Visualizar'}
                  </button>
                </div>
                {showTotalesGenerales && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`, gap: gridGap }}>
                    <div style={{
                      gridColumn: '1 / -1',
                      padding: '1rem',
                      borderRadius: '12px',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #6ee7b7',
                      marginBottom: '0.25rem'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#047857', marginBottom: '0.35rem', fontWeight: 600 }}>
                        Total ventas (solo cobros de pedidos)
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>
                        {movementsLoading ? '…' : currencyFormatter.format(totalVentasSinManual)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.35rem', lineHeight: 1.4 }}>
                        Sin ingresos ni egresos manuales de caja
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Ingresos</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                        {currencyFormatter.format(preview.totalIncome)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Egresos</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                        {currencyFormatter.format(preview.totalExpense)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Neto Total</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: preview.netTotal >= 0 ? '#16a34a' : '#dc2626' }}>
                        {currencyFormatter.format(preview.netTotal)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Movimientos de caja (pagos pendientes de cierre) — mostrar/ocultar con botón */}
              <div style={{
                padding: cardPadding,
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: gridGap
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: showMovements ? '1rem' : 0 }}>
                  <h4 style={{ margin: 0, fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                    📋 Movimientos de caja
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowMovements((v) => !v)}
                    style={{
                      padding: buttonPadding,
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: showMovements ? '#64748b' : '#3b82f6',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: buttonFontSize
                    }}
                  >
                    {showMovements ? 'Ocultar' : 'Visualizar'}
                  </button>
                </div>
                {showMovements && (
                  <>
                    {movementsLoading ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                        Cargando movimientos...
                      </div>
                    ) : movements.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                        No hay movimientos pendientes de cierre
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Fecha / Hora</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Tipo</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Método</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Monto</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Usuario</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Referencia / Notas</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Documento</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Imprimir</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Anular</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movements.map((mov) => {
                              const dateStr = (mov as any).paymentDate ?? (mov as any).payment_date ?? mov.paymentDate;
                              const amount = Number((mov as any).paidAmount ?? (mov as any).paid_amount ?? mov.paidAmount ?? 0);
                              const type = (mov as any).transactionType ?? (mov as any).transaction_type ?? mov.transactionType ?? '';
                              const method = (mov as any).paymentMethod ?? (mov as any).payment_method ?? mov.paymentMethod ?? '';
                              const doc = mov.issuedDocument ?? (mov as any).issued_document;
                              const docLabel = doc ? `${doc.serial ?? ''}-${doc.number ?? ''}`.replace(/^-|-$/g, '') || '—' : '—';
                              const isCancelled = isCancelledCashMovement(mov);
                              const canCancel = canCancelManualCashMovement(mov);
                              return (
                                <tr
                                  key={mov.id}
                                  style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    opacity: isCancelled ? 0.48 : 1,
                                    backgroundColor: isCancelled ? 'rgba(241, 245, 249, 0.65)' : undefined,
                                    filter: isCancelled ? 'grayscale(0.35)' : undefined,
                                    transition: 'opacity 0.15s ease'
                                  }}
                                  title={isCancelled ? 'Movimiento anulado (no cuenta en caja)' : undefined}
                                >
                                  <td style={{ padding: '0.75rem', color: '#334155' }}>
                                    {dateStr ? formatDate(dateStr) : '—'}
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <span style={{
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      backgroundColor: isCancelled
                                        ? '#e2e8f0'
                                        : type === 'INCOME'
                                          ? '#dcfce7'
                                          : '#fee2e2',
                                      color: isCancelled
                                        ? '#64748b'
                                        : type === 'INCOME'
                                          ? '#166534'
                                          : '#991b1b'
                                    }}>
                                      {getTransactionTypeLabel(type)}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', color: isCancelled ? '#94a3b8' : '#475569' }}>
                                    {getPaymentMethodLabel(method)}
                                  </td>
                                  <td style={{
                                    padding: '0.75rem',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    color: isCancelled ? '#94a3b8' : type === 'INCOME' ? '#16a34a' : '#dc2626',
                                    textDecoration: isCancelled ? 'line-through' : undefined
                                  }}>
                                    {type === 'EXPENSE' ? '-' : ''}{currencyFormatter.format(amount)}
                                  </td>
                                  <td style={{ padding: '0.75rem', color: isCancelled ? '#94a3b8' : '#64748b' }}>
                                    {mov.user?.fullName ?? (mov as any).user?.full_name ?? '—'}
                                  </td>
                                  <td style={{ padding: '0.75rem', color: isCancelled ? '#94a3b8' : '#64748b', fontSize: '0.75rem' }}>
                                    <div style={{ fontWeight: 600, color: isCancelled ? '#94a3b8' : '#475569' }}>
                                      {mov.operation?.order ? `Op: ${mov.operation.order}` : '—'}
                                    </div>
                                    <div style={{ fontStyle: 'italic', marginTop: '0.1rem' }}>
                                      {mov.notes || '—'}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.75rem', color: isCancelled ? '#94a3b8' : '#64748b', fontSize: '0.75rem' }}>
                                    {docLabel}
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrintPayment(mov.id);
                                      }}
                                      disabled={printingPaymentId === mov.id}
                                      title="Imprimir este movimiento (incluye anulados)"
                                      style={{
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: printingPaymentId === mov.id ? '#94a3b8' : '#2563eb',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        cursor: printingPaymentId === mov.id ? 'not-allowed' : 'pointer',
                                        opacity: printingPaymentId === mov.id ? 0.8 : 1
                                      }}
                                    >
                                      {printingPaymentId === mov.id ? 'Imprimiendo...' : '🖨️'}
                                    </button>
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                    {isCancelled ? (
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: 700,
                                          backgroundColor: '#f1f5f9',
                                          color: '#64748b',
                                          border: '1px dashed #cbd5e1'
                                        }}
                                        title="Este movimiento fue anulado"
                                      >
                                        Anulado
                                      </span>
                                    ) : canCancel && canVoidManualMovementInList ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCancelManualPayment(mov.id);
                                        }}
                                        disabled={cancelingPaymentId === mov.id}
                                        title="Anular solo ingreso/egreso manual"
                                        style={{
                                          padding: '0.35rem 0.55rem',
                                          borderRadius: '8px',
                                          border: 'none',
                                          backgroundColor: cancelingPaymentId === mov.id ? '#94a3b8' : '#b91c1c',
                                          color: 'white',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          cursor: cancelingPaymentId === mov.id ? 'not-allowed' : 'pointer',
                                          opacity: cancelingPaymentId === mov.id ? 0.85 : 1
                                        }}
                                      >
                                        {cancelingPaymentId === mov.id ? '…' : 'Anular'}
                                      </button>
                                    ) : canCancel && !canVoidManualMovementInList ? (
                                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }} title="Sin permiso para anular movimientos en caja">
                                        —
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }} title="Ventas, compras u operaciones con orden no se anulan aquí">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resumen por método de pago (total caja, del preview) */}
              {preview.generalPaymentMethods && preview.generalPaymentMethods.length > 0 && (
                <div style={{ marginBottom: gridGap }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem', fontWeight: 600, color: '#475569' }}>
                    Resumen por método de pago
                  </h4>
                  <div
                    style={{
                      padding: cardPadding,
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      {preview.generalPaymentMethods.map((method, methodIdx) => {
                        const pmTheme = getPaymentMethodCardTheme(method.methodCode);
                        return (
                        <div
                          key={`${method.methodCode}-${methodIdx}`}
                          style={{
                            flex: '1 1 160px',
                            minWidth: '140px',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            backgroundColor: pmTheme.bg,
                            border: `1px solid ${pmTheme.border}`
                          }}
                        >
                          <div style={{
                            fontWeight: 700,
                            color: pmTheme.color,
                            marginBottom: '0.5rem',
                            fontSize: '0.9rem',
                            opacity: 0.95
                          }}>
                            {method.methodName}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem' }}>
                            Ingresos: <span style={{ color: '#16a34a', fontWeight: 600 }}>{currencyFormatter.format(method.income)}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.35rem' }}>
                            Egresos: <span style={{ color: '#dc2626', fontWeight: 600 }}>{currencyFormatter.format(method.expense)}</span>
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: method.net >= 0 ? pmTheme.color : '#dc2626'
                          }}>
                            Neto: {currencyFormatter.format(method.net)}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Botón de Cerrar Caja (solo con permiso sales.close / admin) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: gridGap, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPreview(false);
                    setSelectedCashRegister('');
                    setSelectedUserId(null);
                  }}
                  style={{
                    padding: buttonPadding,
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: buttonFontSize
                  }}
                >
                  {canCloseCashRegister ? 'Cancelar' : 'Volver'}
                </button>
                {canCloseCashRegister && (
                  <button
                    type="button"
                    onClick={handleCloseCashClick}
                    disabled={!preview.canClose || closingCash}
                    style={{
                      padding: buttonPadding,
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: preview.canClose ? '#16a34a' : '#94a3b8',
                      color: 'white',
                      cursor: preview.canClose && !closingCash ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: buttonFontSize,
                      opacity: preview.canClose && !closingCash ? 1 : 0.6
                    }}
                  >
                    {closingCash ? 'Cerrando...' : '✅ Cerrar Caja'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No se pudo cargar el preview de cierre
            </div>
          )}
        </div>
      )}

      {/* Vista de Historial de Cierres */}
      {showHistory && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: cardPadding,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: isSmall ? '1rem' : isMedium ? '1.125rem' : isSmallDesktop ? '1.125rem' : '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                📜 Historial de Cierres de Caja
              </h3>
              <p style={{ margin: 0, fontSize: subtitleFontSize, color: '#64748b' }}>
                {closures.length > 0 ? `${closures.length} cierre(s) registrado(s)` : 'No hay cierres registrados'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => refetchClosures()}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                title="Actualizar historial"
              >
                🔄 Actualizar
              </button>
              <button
                onClick={() => {
                  setShowHistory(false);
                }}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize
                }}
              >
                ← Volver
              </button>
            </div>
          </div>

          {/* Filtro de fechas */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Filtrar por fechas:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              Desde
              <input
                type="date"
                value={closureFilterStart}
                onChange={(e) => setClosureFilterStart(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  color: '#334155'
                }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              Hasta
              <input
                type="date"
                value={closureFilterEnd}
                onChange={(e) => setClosureFilterEnd(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  color: '#334155'
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setClosureFilterStart('');
                setClosureFilterEnd('');
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                color: '#64748b',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Limpiar filtro
            </button>
          </div>

          {closuresLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p style={{ fontSize: '1rem', margin: 0 }}>Cargando historial de cierres...</p>
            </div>
          ) : closures.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <p style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', fontWeight: 600 }}>No hay cierres registrados</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>
                Los cierres de caja aparecerán aquí una vez que se realicen
              </p>
            </div>
          ) : (
            <>
              {/* Resumen del historial */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${statCardMinWidth}, 1fr))`,
                gap: gridGap,
                marginBottom: gridGap,
                padding: cardPadding,
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Cierres</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#334155' }}>
                    {closures.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Ingresos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                    {currencyFormatter.format(closures.reduce((sum, c) => sum + Number((c as any).totalIncome ?? (c as any).total_income ?? 0), 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Egresos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                    {currencyFormatter.format(closures.reduce((sum, c) => sum + Number((c as any).totalExpense ?? (c as any).total_expense ?? 0), 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Neto Total</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#334155' }}>
                    {currencyFormatter.format(closures.reduce((sum, c) => sum + Number((c as any).netTotal ?? (c as any).net_total ?? 0), 0))}
                  </div>
                </div>
              </div>

              {/* Tabla de cierres */}
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{
                      borderBottom: '2px solid #e2e8f0',
                      backgroundColor: '#f8fafc'
                    }}>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>N° Cierre</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Caja</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Usuario</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Fecha y Hora</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Ingresos</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Egresos</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Neto</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closures.map((closure, index) => {
                      const { bg: cashBg, color: cashColor } = getCashTypeColor(closure.cashRegister.cashType);
                      return (
                        <tr
                          key={closure.id}
                          style={{
                            borderBottom: index < closures.length - 1 ? '1px solid #f1f5f9' : 'none',
                            transition: 'background-color 0.2s',
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedClosureForDetail(closure as CashClosureForDetail)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ padding: '1rem', color: '#334155', fontWeight: 700 }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '6px',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              fontSize: '0.75rem'
                            }}>
                              #{closure.closureNumber}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#334155', textAlign: 'center' }}>
                            <div style={{ display: 'flex', textAlign: 'center', gap: '0.5rem' }}>
                              <span style={{
                                textAlign: 'center',
                                fontWeight: 500,
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                backgroundColor: cashBg,
                                color: cashColor
                              }}>
                                {closure.cashRegister.name}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', color: '#334155' }}>
                            <div>
                              <div style={{ fontWeight: 500 }}>{closure.user.fullName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {closure.user.role}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', color: '#64748b' }}>
                            <div>
                              <div>{formatDate(closure.closedAt)}</div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                            {currencyFormatter.format(Number((closure as any).totalIncome ?? (closure as any).total_income ?? 0))}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>
                            {currencyFormatter.format(Number((closure as any).totalExpense ?? (closure as any).total_expense ?? 0))}
                          </td>
                          <td style={{
                            padding: '1rem',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '1rem',
                            color: (Number((closure as any).netTotal ?? (closure as any).net_total ?? 0) >= 0) ? '#16a34a' : '#dc2626'
                          }}>
                            {currencyFormatter.format(Number((closure as any).netTotal ?? (closure as any).net_total ?? 0))}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleReprintClosure(closure)}
                              disabled={reprintingClosureId === closure.id || reprintingClosure}
                              title="Reimprimir este cierre"
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: reprintingClosureId === closure.id ? '#94a3b8' : '#2563eb',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: reprintingClosureId === closure.id ? 'not-allowed' : 'pointer',
                                opacity: reprintingClosureId === closure.id ? 0.8 : 1
                              }}
                            >
                              {reprintingClosureId === closure.id ? 'Imprimiendo...' : 'Reimprimir'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de Confirmación para Cerrar Caja */}
      {showConfirmModal && canCloseCashRegister && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: cardPadding,
              maxWidth: isSmall ? '400px' : isMedium ? '450px' : isSmallDesktop ? '450px' : '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: isSmall ? '2rem' : isMedium ? '2.5rem' : isSmallDesktop ? '2.5rem' : '3rem',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                ⚠️
              </div>
              <h3 style={{
                margin: '0 0 0.5rem',
                fontSize: isSmall ? '1.125rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                color: '#1e293b',
                textAlign: 'center'
              }}>
                Confirmar Cierre de Caja
              </h3>
              <p style={{
                margin: 0,
                fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : isSmallDesktop ? '0.9375rem' : '1rem',
                color: '#64748b',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                ¿Estás seguro de que deseas cerrar esta caja? Esta acción agrupará todos los pagos pendientes en un cierre.
              </p>
            </div>

            {preview && (
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: cardPadding,
                marginBottom: '1.5rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Resumen del cierre:
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  fontSize: '0.875rem'
                }}>
                  <div>
                    <div style={{ color: '#64748b' }}>Ingresos:</div>
                    <div style={{ fontWeight: 600, color: '#16a34a' }}>
                      {currencyFormatter.format(preview.totalIncome)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Egresos:</div>
                    <div style={{ fontWeight: 600, color: '#dc2626' }}>
                      {currencyFormatter.format(preview.totalExpense)}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b' }}>Neto Total:</div>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', color: preview.netTotal >= 0 ? '#16a34a' : '#dc2626' }}>
                      {currencyFormatter.format(preview.netTotal)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCloseCash}
                disabled={closingCash}
                style={{
                  padding: buttonPadding,
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: closingCash ? '#94a3b8' : '#16a34a',
                  color: 'white',
                  cursor: closingCash ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: buttonFontSize,
                  transition: 'all 0.2s',
                  opacity: closingCash ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!closingCash) {
                    e.currentTarget.style.backgroundColor = '#15803d';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!closingCash) {
                    e.currentTarget.style.backgroundColor = '#16a34a';
                  }
                }}
              >
                {closingCash ? 'Cerrando...' : '✅ Confirmar y Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de cierre de caja */}
      <CashDetailModal
        isOpen={!!selectedClosureForDetail}
        onClose={() => setSelectedClosureForDetail(null)}
        closure={selectedClosureForDetail}
        onReprint={handleReprintClosure}
        reprintingClosureId={reprintingClosureId}
      />

      {/* Modal de Transacción Manual */}
      <ManualTransactionModal
        isOpen={showManualTransactionModal}
        onClose={() => setShowManualTransactionModal(false)}
        onSuccess={() => {
          refetchCashRegisters();
        }}
        cashRegisters={cashRegisters}
        userId={user?.id || ''}
        branchId={branchId || ''}
        allowChangePaymentMethod={canChangeManualPaymentMethod}
      />
    </div>
  );
};

export default Cashs;