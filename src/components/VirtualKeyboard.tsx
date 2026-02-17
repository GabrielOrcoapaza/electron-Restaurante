import React, { useState } from 'react';

type VirtualKeyboardProps = {
	onKeyPress: (key: string) => void;
	onBackspace: () => void;
	disabled?: boolean;
	compact?: boolean;
};

// Filas del teclado en español (minúsculas y con shift)
const ROW1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const ROW2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'];
const ROW3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'];
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const SYMBOLS = ['@', '#', '$', '%', '&', '*', '-', '+', '=', '/'];

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
	onKeyPress,
	onBackspace,
	disabled = false,
	compact = false
}) => {
	const [shift, setShift] = useState(false);
	const [showNumbers, setShowNumbers] = useState(false);

	const handleKey = (key: string) => {
		if (disabled) return;
		if (key === '⇧') {
			setShift(s => !s);
			return;
		}
		if (key === '123') {
			setShowNumbers(true);
			return;
		}
		if (key === 'ABC') {
			setShowNumbers(false);
			return;
		}
		if (key === '⌫') {
			onBackspace();
			return;
		}
		const char = key === ' ' ? ' ' : (shift && key.length === 1 ? key.toUpperCase() : key.toLowerCase());
		onKeyPress(char);
		if (shift && key !== ' ') setShift(false);
	};

	// Teclas más grandes y gruesas para uso táctil (mozos, dedos gordos)
	const keyStyle: React.CSSProperties = {
		minWidth: compact ? 42 : 48,
		height: compact ? 58 : 68,
		padding: compact ? '0.4rem 0.5rem' : '0.5rem 0.6rem',
		fontSize: compact ? 34 : 37,
		fontWeight: 700,
		border: '1px solid #cbd5e0',
		borderRadius: 8,
		background: '#fff',
		color: '#1e293b',
		cursor: disabled ? 'not-allowed' : 'pointer',
		opacity: disabled ? 0.6 : 1,
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
		transition: 'all 0.15s ease'
	};

	const specialKeyStyle: React.CSSProperties = {
		...keyStyle,
		background: '#e2e8f0',
		color: '#475569',
		minWidth: compact ? 48 : 56
	};

	const spaceKeyStyle: React.CSSProperties = {
		...keyStyle,
		flex: 1,
		minWidth: compact ? 120 : 180,
		maxWidth: compact ? 200 : 300,
		background: '#e2e8f0',
		color: '#334155',
		border: '2px solid #94a3b8',
		fontWeight: 700,
		fontSize: compact ? 13 : 15
	};

	const rowStyle: React.CSSProperties = {
		display: 'flex',
		gap: compact ? 5 : 6,
		justifyContent: 'center',
		marginBottom: compact ? 5 : 6
	};

	if (showNumbers) {
		return (
			<div style={{ padding: compact ? '0.6rem' : '0.9rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
				<div style={rowStyle}>
					{NUMBERS.map(k => (
						<button
							key={k}
							type="button"
							onClick={() => handleKey(k)}
							style={keyStyle}
							onMouseDown={e => e.preventDefault()}
						>
							{k}
						</button>
					))
					}
				</div>
				<div style={rowStyle}>
					{SYMBOLS.map(k => (
						<button
							key={k}
							type="button"
							onClick={() => handleKey(k)}
							style={keyStyle}
							onMouseDown={e => e.preventDefault()}
						>
							{k}
						</button>
					))
					}
				</div>
				<div style={rowStyle}>
					<button type="button" onClick={() => setShowNumbers(false)} style={specialKeyStyle} onMouseDown={e => e.preventDefault()}>
						ABC
					</button>
					<button type="button" onClick={() => handleKey(' ')} style={spaceKeyStyle} onMouseDown={e => e.preventDefault()}>
						Espacio
					</button>
					<button type="button" onClick={() => handleKey('⌫')} style={specialKeyStyle} onMouseDown={e => e.preventDefault()}>
						⌫
					</button>
				</div>
			</div>
		);
	}

	return (
		<div style={{ padding: compact ? '0.6rem' : '0.9rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
			<div style={rowStyle}>
				{ROW1.map(k => (
					<button
						key={k}
						type="button"
						onClick={() => handleKey(k)}
						style={keyStyle}
						onMouseDown={e => e.preventDefault()}
					>
						{shift ? k.toUpperCase() : k}
					</button>
				))}
			</div>
			<div style={rowStyle}>
				{ROW2.map(k => (
					<button
						key={k}
						type="button"
						onClick={() => handleKey(k)}
						style={keyStyle}
						onMouseDown={e => e.preventDefault()}
					>
						{shift ? k.toUpperCase() : k}
					</button>
				))}
			</div>
			<div style={rowStyle}>
				<button type="button" onClick={() => handleKey('⇧')} style={{ ...specialKeyStyle, background: shift ? '#c7d2fe' : '#e2e8f0' }} onMouseDown={e => e.preventDefault()}>
					⇧
				</button>
				{ROW3.map(k => (
					<button
						key={k}
						type="button"
						onClick={() => handleKey(k)}
						style={keyStyle}
						onMouseDown={e => e.preventDefault()}
					>
						{shift && k.length === 1 ? k.toUpperCase() : k}
					</button>
				))}
				<button type="button" onClick={() => handleKey('⌫')} style={specialKeyStyle} onMouseDown={e => e.preventDefault()}>
					⌫
				</button>
			</div>
			<div style={rowStyle}>
				<button type="button" onClick={() => setShowNumbers(true)} style={specialKeyStyle} onMouseDown={e => e.preventDefault()}>
					123
				</button>
				<button type="button" onClick={() => handleKey(' ')} style={spaceKeyStyle} onMouseDown={e => e.preventDefault()}>
					Espacio
				</button>
			</div>
		</div>
	);
};

export default VirtualKeyboard;
