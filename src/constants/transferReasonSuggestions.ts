// Mensajes sugeridos para los campos "Motivo" (TransferStockModal, transferencias
// entre almacenes de la misma sucursal) y "Notas" (SendTransferModal,
// transferencias entre sucursales distintas). Son solo sugerencias: el usuario
// siempre puede escribir texto libre en el input.
const COMMON_TRANSFER_SUGGESTIONS = [
    "Prevención de desabasto",
    "Equilibrio de stock",
    "Consolidación de mercancía",
    "Reposición de almacén",
    "Rotación de stock",
];

export const WAREHOUSE_TRANSFER_MOTIVE_SUGGESTIONS = [
    ...COMMON_TRANSFER_SUGGESTIONS,
    "Reorganización de almacenes",
    "Ajuste de inventario",
];

export const BRANCH_TRANSFER_NOTE_SUGGESTIONS = [
    ...COMMON_TRANSFER_SUGGESTIONS,
    "Traslado programado",
    "Reabastecimiento de urgencia",
];
