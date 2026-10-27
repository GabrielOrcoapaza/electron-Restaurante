function isFocusedNumberInput(): boolean {
    const target = document.activeElement;
    return target instanceof HTMLInputElement && target.type === 'number';
}

/** Evita rueda del mouse y flechas ↑↓ en teclado físico en input[type=number]. */
export function installNumberInputWheelGuard(): void {
    document.addEventListener(
        'wheel',
        (event) => {
            if (isFocusedNumberInput()) {
                event.preventDefault();
            }
        },
        { passive: false, capture: true },
    );

    document.addEventListener(
        'keydown',
        (event) => {
            if (
                (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
                isFocusedNumberInput()
            ) {
                event.preventDefault();
            }
        },
        { capture: true },
    );
}
