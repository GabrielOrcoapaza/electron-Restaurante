type PersonLike = {
    id?: string;
    name?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    isSupplier?: boolean;
    isActive?: boolean | null;
};

/** Filtra clientes para el buscador de caja/POS/delivery. */
export function filterPersonsForCustomerSearch<T extends PersonLike>(
    persons: T[],
    searchTerm: string,
    options?: { isFactura?: boolean; limit?: number },
): T[] {
    const limit = options?.limit ?? 50;
    let clients = persons.filter(
        (c) => !c.isSupplier && c.isActive !== false,
    );
    if (options?.isFactura) {
        clients = clients.filter(
            (c) => (c.documentType || "").toUpperCase() === "RUC",
        );
    }

    const term = (searchTerm || "").trim();
    if (!term) return clients.slice(0, limit);

    const lower = term.toLowerCase();
    const digitsOnly = term.replace(/\s/g, "");
    const isFullDocument =
        /^\d{8}$/.test(digitsOnly) || /^\d{11}$/.test(digitsOnly);

    if (isFullDocument) {
        return clients
            .filter(
                (c) =>
                    (c.documentNumber || "").replace(/\s/g, "") === digitsOnly,
            )
            .slice(0, limit);
    }

    return clients
        .filter(
            (c) =>
                (c.name || "").toLowerCase().includes(lower) ||
                (c.documentNumber || "").toLowerCase().includes(lower),
        )
        .slice(0, limit);
}

export type PersonSearchLogPayload = {
    person?: {
        id?: string | null;
        name?: string | null;
        documentType?: string | null;
        documentNumber?: string | null;
    } | null;
    foundLocally?: boolean | null;
    foundInSunat?: boolean | null;
};

/** Log en consola del navegador para rastrear BD vs RENIEC/SUNAT. */
export function logPersonSearchResult(
    screen: string,
    documentType: string,
    documentNumber: string,
    result: PersonSearchLogPayload | null | undefined,
): void {
    const prefix = `[Cliente/${screen}]`;
    const doc = `${documentType} ${documentNumber}`;

    if (!result?.person) {
        console.info(
            `${prefix} ${doc} → no encontrado (ni BD ni RENIEC/SUNAT)`,
        );
        return;
    }

    const { person } = result;
    const id = person.id ?? "sin-id";
    const name = person.name ?? "";

    if (result.foundLocally) {
        console.info(
            `${prefix} ${doc} → BD local (id=${id}, nombre="${name}") — sin consulta RENIEC/SUNAT`,
        );
        return;
    }

    if (result.foundInSunat) {
        const source =
            documentType.toUpperCase() === "DNI" ? "RENIEC" : "SUNAT";
        console.info(
            `${prefix} ${doc} → ${source} (id=${id}, nombre="${name}") — guardado en BD`,
        );
        return;
    }

    console.info(
        `${prefix} ${doc} → respuesta parcial (id=${id}, foundLocally=${result.foundLocally}, foundInSunat=${result.foundInSunat})`,
    );
}
