/** Evita que la rueda del mouse cambie el valor con foco en input[type=number]. */
export function installNumberInputWheelGuard(): void {
    document.addEventListener(
        'wheel',
        (event) => {
            const target = document.activeElement;
            if (
                target instanceof HTMLInputElement &&
                target.type === 'number'
            ) {
                event.preventDefault();
            }
        },
        { passive: false, capture: true },
    );
}
