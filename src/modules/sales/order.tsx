import React from 'react';
import type { Table } from '../../types/table';

type OrderProps = {
	table: Table;
	onClose: () => void;
};

const Order: React.FC<OrderProps> = ({ table, onClose }) => {
	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15))',
			backdropFilter: 'blur(6px)',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			zIndex: 1100,
			padding: '1rem'
		}}>
			<div style={{
				background: 'rgba(255,255,255,0.9)',
				borderRadius: '16px',
				width: '100%',
				maxWidth: '1400px',
				height: '92vh',
				boxShadow: '0 25px 80px rgba(0,0,0,0.20)',
				overflow: 'hidden',
				border: '1px solid rgba(226,232,240,0.8)',
				display: 'flex',
				flexDirection: 'column'
			}}>
				{/* Header */}
				<div style={{
					background: 'linear-gradient(135deg, #667eea, #764ba2)',
					padding: '1rem 1.25rem',
					color: 'white',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between'
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.6rem',
							fontWeight: 700
						}}>
							🍽️ Nueva Orden
						</div>
						<h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Mesa {table.name.replace('MESA ','')}</h3>
						<span style={{ opacity: 0.9 }}>•</span>
						<div style={{
							backgroundColor: 'rgba(255,255,255,0.15)',
							borderRadius: 12,
							padding: '0.35rem 0.6rem',
							fontWeight: 600
						}}>
							Capacidad {table.capacity}
						</div>
					</div>
					<button onClick={onClose} style={{
						background: 'rgba(255,255,255,0.15)',
						border: '1px solid rgba(255,255,255,0.35)',
						color: 'white',
						padding: '0.45rem 0.9rem',
						borderRadius: 10,
						cursor: 'pointer',
						fontWeight: 600
					}}>
						Cerrar
					</button>
				</div>

				{/* Body */}
				<div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', padding: '1rem', flex: 1, overflow: 'auto' }}>
					{/* Col izquierda: búsqueda y catálogo */}
					<div style={{ display: 'grid', gap: '1rem' }}>
						<div style={{
							background: 'white',
							border: '1px solid #e2e8f0',
							borderRadius: 14,
							padding: '0.85rem 0.9rem'
						}}>
							<div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '0.75rem' }}>
								<div style={{ position: 'relative' }}>
									<span style={{ position: 'absolute', left: 10, top: 10, opacity: 0.6 }}>🔎</span>
									<input placeholder="Buscar producto o escanear código" style={{
										width: '100%', padding: '0.65rem 0.85rem 0.65rem 2rem',
										border: '1px solid #e2e8f0', borderRadius: 10
									}} />
								</div>
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
									<input type="number" placeholder="Cant." style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem 0.75rem' }} />
									<button style={{
										background: '#667eea', color: 'white', border: 'none', borderRadius: 10,
										fontWeight: 700, cursor: 'pointer'
									}}>
										Agregar
									</button>
								</div>
							</div>
							<div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
								{['Todos','Bebidas','Platos','Entradas','Postres','Promos'].map((c) => (
									<span key={c} style={{
										padding: '0.35rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 9999,
										background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#4a5568'
									}}>{c}</span>
								))}
							</div>
						</div>

						{/* Grid de productos (placeholder) */}
						<div style={{
							display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem'
						}}>
							{Array.from({ length: 8 }).map((_, i) => (
								<div key={i} style={{
									background: 'white', border: '1px solid #e2e8f0', borderRadius: 14,
									padding: '0.75rem', cursor: 'pointer', transition: 'transform 120ms ease',
									display: 'grid', gap: '0.35rem', textAlign: 'center'
								}}>
									<div style={{ fontSize: '2rem' }}>{['🥤','🍔','🍟','🍕','🍰','🍺','🍜','🥗'][i % 8]}</div>
									<div style={{ fontWeight: 700, color: '#2d3748' }}>Producto {i + 1}</div>
									<div style={{ fontWeight: 700, color: '#667eea' }}>$ {(i + 1) * 3}.00</div>
								</div>
							))}
						</div>
					</div>

					{/* Col derecha: resumen de orden */}
					<div style={{ display: 'grid', gap: '1rem' }}>
						<div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1rem' }}>
							<h4 style={{ margin: '0 0 0.75rem 0', color: '#2d3748' }}>Detalle</h4>
							<div style={{
								border: '1px dashed #cbd5e0', borderRadius: 12, padding: '1rem', textAlign: 'center', color: '#718096'
							}}>
								Aquí aparecerán los ítems agregados.
							</div>
						</div>

						<div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5568' }}>
								<span>Subtotal</span>
								<b>$ 0.00</b>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5568' }}>
								<span>Impuestos</span>
								<b>$ 0.00</b>
							</div>
							<div style={{ height: 1, background: '#e2e8f0', margin: '0.25rem 0' }} />
							<div style={{ display: 'flex', justifyContent: 'space-between', color: '#2d3748', fontSize: 18, fontWeight: 800 }}>
								<span>Total</span>
								<span>$ 0.00</span>
							</div>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
							<button style={{ padding: '0.85rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontWeight: 700, color: '#4a5568' }}>Guardar borrador</button>
							<button style={{ padding: '0.85rem', background: '#edf2ff', border: '1px solid #c3dafe', color: '#3730a3', borderRadius: 12, cursor: 'pointer', fontWeight: 800 }}>Enviar a cocina</button>
							<button style={{ padding: '0.85rem', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 800 }}>Cobrar</button>
						</div>
					</div>
				</div>

				{/* Footer hints */}
				<div style={{
					padding: '0.6rem 1rem', display: 'flex', justifyContent: 'center', gap: '1rem', borderTop: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.85)'
				}}>
					<span style={{ color: '#718096', fontSize: 12 }}>Atajos: ⏎ Agregar • Ctrl+K Buscar • Esc Cerrar</span>
				</div>
			</div>
		</div>
	);
};

export default Order;


