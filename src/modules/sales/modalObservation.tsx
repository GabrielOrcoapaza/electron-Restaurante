import React, { useState, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import VirtualKeyboard from '../../components/VirtualKeyboard';

type Observation = {
	id: string;
	note: string;
};

type ModalObservationProps = {
	isOpen: boolean;
	onClose: () => void;
	observations: Observation[];
	selectedObservationIds: Set<string>;
	onApply: (selectedIds: Set<string>, manualNotes: string) => void;
	productName: string;
	currentNotes: string;
	canEdit: boolean;
};

const ModalObservation: React.FC<ModalObservationProps> = ({
	isOpen,
	onClose,
	observations,
	selectedObservationIds,
	onApply,
	productName,
	currentNotes,
	canEdit
}) => {
	const { breakpoint } = useResponsive();
	const isSmall = breakpoint === 'sm';
	const isMedium = breakpoint === 'md';
	const isSmallDesktop = breakpoint === 'lg';

	const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
	const [manualNotes, setManualNotes] = useState<string>('');

	// Función para obtener el texto completo de las notas (observaciones seleccionadas + notas manuales)
	const getFullNotesText = (selectedIds: Set<string>, manual: string): string => {
		const selectedObservationNotes = Array.from(selectedIds)
			.map(id => {
				const obs = observations.find(o => o.id === id);
				return obs?.note || '';
			})
			.filter(note => note !== '');
		const parts: string[] = [];
		if (selectedObservationNotes.length > 0) {
			parts.push(...selectedObservationNotes);
		}
		// Mostrar manualNotes tal cual (sin trim) para que se vean espacios al escribir
		if (manual != null && manual !== '') {
			parts.push(manual);
		}
		return parts.join(', ');
	};

	// El teclado virtual solo edita la parte de notas manuales, así se conservan comas y cualquier carácter
	const handleVirtualKeyPress = (key: string) => {
		if (!canEdit) return;
		setManualNotes(prev => prev + key);
	};

	const handleVirtualBackspace = () => {
		if (!canEdit) return;
		setManualNotes(prev => prev.slice(0, -1));
	};

	// Sincronizar las selecciones locales y notas manuales con las props cuando cambian
	useEffect(() => {
		if (isOpen) {
			setLocalSelected(new Set(selectedObservationIds));
			
			// Extraer las notas manuales (excluyendo las observaciones)
			const allObservationNotes = observations.map(obs => obs.note);
			const currentNotesArray = currentNotes ? currentNotes.split(', ').map(n => n.trim()) : [];
			const manualNotesArray = currentNotesArray
				.filter(note => !allObservationNotes.includes(note))
				.filter(note => note !== '');
			setManualNotes(manualNotesArray.join(', '));
		}
	}, [isOpen, selectedObservationIds, currentNotes, observations]);

	if (!isOpen) return null;

	const modalPadding = isSmall ? '1rem' : isMedium ? '1.25rem' : isSmallDesktop ? '1.5rem' : '2rem';
	const modalMaxWidth = isSmall ? '95%' : isMedium ? '580px' : isSmallDesktop ? '680px' : '760px';
	const titleFontSize = isSmall ? '1rem' : isMedium ? '1.125rem' : '1.25rem';

	const handleToggle = (observationId: string) => {
		if (!canEdit) return;
		
		setLocalSelected(prev => {
			const updated = new Set(prev);
			if (updated.has(observationId)) {
				updated.delete(observationId);
			} else {
				updated.add(observationId);
			}
			// Actualizar automáticamente el campo de notas con las observaciones seleccionadas
			// Las notas manuales se mantienen
			return updated;
		});
	};

	const handleApply = () => {
		onApply(localSelected, manualNotes.trim());
		onClose();
	};

	const handleCancel = () => {
		setLocalSelected(new Set(selectedObservationIds));
		// Restaurar las notas manuales originales
		const allObservationNotes = observations.map(obs => obs.note);
		const currentNotesArray = currentNotes ? currentNotes.split(', ').map(n => n.trim()) : [];
		const manualNotesArray = currentNotesArray
			.filter(note => !allObservationNotes.includes(note))
			.filter(note => note !== '');
		setManualNotes(manualNotesArray.join(', '));
		onClose();
	};

	return (
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
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					handleCancel();
				}
			}}
		>
			<div
				style={{
					backgroundColor: 'white',
					borderRadius: '20px',
					padding: modalPadding,
					maxWidth: modalMaxWidth,
					width: '100%',
					maxHeight: '95vh',
					minHeight: '50vh',
					overflowY: 'auto',
					boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
					position: 'relative'
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Botón cerrar */}
				<button
					onClick={handleCancel}
					style={{
						position: 'absolute',
						top: '1rem',
						right: '1rem',
						background: 'none',
						border: 'none',
						fontSize: '1.5rem',
						cursor: 'pointer',
						color: '#64748b',
						width: '32px',
						height: '32px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: '50%',
						transition: 'background-color 0.2s'
					}}
					onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
					onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
				>
					✕
				</button>

				<h2 style={{ 
					margin: '0 0 1rem', 
					fontSize: titleFontSize, 
					fontWeight: 700, 
					color: '#1e293b' 
				}}>
					📋 Observaciones del Producto
				</h2>

				{productName && (
					<div style={{
						marginBottom: '1.5rem',
						padding: '0.75rem',
						background: '#f0f9ff',
						border: '1px solid #bae6fd',
						borderRadius: '8px'
					}}>
						<p style={{ 
							margin: 0, 
							fontSize: isSmall ? '0.875rem' : '0.9375rem', 
							color: '#0369a1',
							fontWeight: 600
						}}>
							Producto: <span style={{ color: '#0c4a6e' }}>{productName}</span>
						</p>
					</div>
				)}

				{/* Lista de observaciones guardadas (solo si existen) */}
				{observations.length > 0 && (
					<div style={{
						display: 'flex',
						flexDirection: 'row',
						flexWrap: 'wrap',
						gap: '0.75rem',
						marginBottom: '1.5rem'
					}}>
						{observations.map((observation) => {
							const isSelected = localSelected.has(observation.id);
							return (
								<button
									key={observation.id}
									type="button"
									onClick={() => handleToggle(observation.id)}
									disabled={!canEdit}
									style={{
										fontSize: isSmall ? '0.875rem' : isMedium ? '0.9375rem' : '1rem',
										color: isSelected ? '#0369a1' : '#0c4a6e',
										padding: '0.5rem 1rem',
										background: isSelected ? '#dbeafe' : 'white',
										borderRadius: '999px',
										border: isSelected ? '2px solid #3b82f6' : '1px solid #e0f2fe',
										cursor: canEdit ? 'pointer' : 'not-allowed',
										textAlign: 'center',
										display: 'inline-flex',
										alignItems: 'center',
										gap: '0.5rem',
										transition: 'all 0.2s ease',
										opacity: canEdit ? 1 : 0.6,
										whiteSpace: 'nowrap',
										fontWeight: isSelected ? 600 : 400
									}}
									onMouseEnter={(e) => {
										if (canEdit) {
											e.currentTarget.style.background = isSelected ? '#bfdbfe' : '#f0f9ff';
											e.currentTarget.style.transform = 'scale(1.05)';
										}
									}}
									onMouseLeave={(e) => {
										if (canEdit) {
											e.currentTarget.style.background = isSelected ? '#dbeafe' : 'white';
											e.currentTarget.style.transform = 'scale(1)';
										}
									}}
								>
									<span style={{
										fontSize: isSmall ? '1rem' : '1.125rem',
										fontWeight: 700
									}}>
										{isSelected ? '✓' : '○'}
									</span>
									<span>{observation.note}</span>
								</button>
							);
						})}
					</div>
				)}

				{/* Campo para escribir observaciones - siempre visible (con o sin observaciones guardadas) */}
				<div style={{
					marginBottom: '1rem'
				}}>
					<label style={{
						display: 'block',
						fontSize: isSmall ? '0.875rem' : '0.9375rem',
						fontWeight: 600,
						color: '#1e293b',
						marginBottom: '0.5rem'
					}}>
						{observations.length > 0 ? '📝 Notas adicionales:' : '📝 Escribe la observación al plato:'}
					</label>
					<textarea
						value={getFullNotesText(localSelected, manualNotes)}
						onChange={(e) => {
							const newValue = e.target.value;
							// Separar por ", " (coma+espacio) como en getFullNotesText; así las comas sueltas se conservan
							const segments = newValue.split(', ');
							const foundObservationIds = new Set<string>();
							const manualNotesArray: string[] = [];
							segments.forEach(segment => {
								const trimmed = segment.trim();
								if (trimmed === '') {
									// Incluir también segmentos vacíos para no perder la ", " (ej: "algo," + espacio)
									manualNotesArray.push(segment);
									return;
								}
								const observation = observations.find(obs => obs.note === trimmed);
								if (observation) {
									foundObservationIds.add(observation.id);
								} else {
									manualNotesArray.push(segment);
								}
							});
							setLocalSelected(foundObservationIds);
							setManualNotes(manualNotesArray.join(', '));
						}}
						disabled={!canEdit}
						placeholder={observations.length > 0
							? 'Las observaciones seleccionadas aparecerán aquí. Puedes agregar notas adicionales...'
							: 'Ej: Sin cebolla, bien cocido, sin sal...'}
						style={{
							width: '100%',
							minHeight: '80px',
							borderRadius: '8px',
							border: '1px solid #cbd5e0',
							padding: '0.75rem',
							fontSize: isSmall ? '0.875rem' : '0.9375rem',
							resize: 'vertical',
							background: canEdit ? 'white' : '#f1f5f9',
							color: canEdit ? '#1a202c' : '#64748b',
							fontFamily: 'inherit',
							lineHeight: '1.5'
						}}
					/>
							{!canEdit && (
								<p style={{
									fontSize: '0.75rem',
									color: '#94a3b8',
									margin: '0.5rem 0 0 0',
									fontStyle: 'italic'
								}}>
									Las notas no se pueden editar para este producto
								</p>
							)}
						</div>

						{/* Teclado virtual */}
						{canEdit && (
							<div style={{ marginTop: '0.75rem' }}>
								<VirtualKeyboard
									onKeyPress={handleVirtualKeyPress}
									onBackspace={handleVirtualBackspace}
									disabled={!canEdit}
									compact={isSmall || isMedium}
								/>
							</div>
						)}

						{/* Botones de acción */}
						<div style={{
							display: 'flex',
							gap: '0.75rem',
							justifyContent: 'flex-end',
							borderTop: '1px solid #e2e8f0',
							paddingTop: '0.75rem',
							marginTop: '0.75rem'
						}}>
							<button
								onClick={handleCancel}
								style={{
									padding: isSmall ? '0.5rem 1rem' : '0.625rem 1.25rem',
									background: '#f1f5f9',
									border: '1px solid #cbd5e0',
									color: '#475569',
									borderRadius: '8px',
									cursor: 'pointer',
									fontWeight: 600,
									fontSize: isSmall ? '0.875rem' : '0.9375rem',
									transition: 'all 0.2s ease'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = '#e2e8f0';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = '#f1f5f9';
								}}
							>
								Cancelar
							</button>
							<button
								onClick={handleApply}
								disabled={!canEdit}
								style={{
									padding: isSmall ? '0.5rem 1rem' : '0.625rem 1.25rem',
									background: canEdit ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#cbd5e0',
									border: 'none',
									color: 'white',
									borderRadius: '8px',
									cursor: canEdit ? 'pointer' : 'not-allowed',
									fontWeight: 700,
									fontSize: isSmall ? '0.875rem' : '0.9375rem',
									opacity: canEdit ? 1 : 0.6,
									transition: 'all 0.2s ease',
									boxShadow: canEdit ? '0 2px 6px rgba(102, 126, 234, 0.3)' : 'none'
								}}
								onMouseEnter={(e) => {
									if (canEdit) {
										e.currentTarget.style.transform = 'translateY(-2px)';
										e.currentTarget.style.boxShadow = '0 4px 10px rgba(102, 126, 234, 0.4)';
									}
								}}
								onMouseLeave={(e) => {
									if (canEdit) {
										e.currentTarget.style.transform = 'translateY(0)';
										e.currentTarget.style.boxShadow = '0 2px 6px rgba(102, 126, 234, 0.3)';
									}
								}}
							>
								Aplicar
							</button>
						</div>
			</div>
		</div>
	);
};

export default ModalObservation;
