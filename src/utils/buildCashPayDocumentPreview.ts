/**
 * Arma el JSON del ticket (mismo formato que document_data del backend)
 * solo con datos visibles en caja, sin esperar createIssuedDocument.
 */

export type CashPayPreviewLineItem = {
	product_name: string;
	quantity: number;
	unit_price: number;
	total: number;
	discount?: number;
	promotion_name?: string | null;
	notes?: string;
};

export type CashPayPreviewAmounts = {
	subtotal: number;
	igv: number;
	igv_percent: number;
	items_discount?: number;
	discount: number;
	discount_percent: number;
	total_discount?: number;
	total: number;
};

export type CashPayPreviewCustomer = {
	name: string;
	document?: string;
	document_type?: string;
	address?: string;
};

export type CashPayPreviewBranch = {
	name?: string;
	address?: string;
	phone?: string;
};

export type CashPayPreviewCompany = {
	denomination?: string;
	commercialName?: string;
	ruc?: string;
	address?: string;
	phone?: string;
};

export type BuildCashPayDocumentPreviewInput = {
	documentTypeLabel: string;
	serial: string;
	company?: CashPayPreviewCompany | null;
	branch: CashPayPreviewBranch;
	customer?: CashPayPreviewCustomer | null;
	tableName?: string | null;
	waiterName?: string | null;
	lineItems: CashPayPreviewLineItem[];
	amounts: CashPayPreviewAmounts;
	emissionDate: string;
	emissionTime: string;
	logoBase64?: string | null;
};

export function documentTypeLabelFromCode(
	code: string,
	description?: string | null,
): string {
	const c = String(code || "").trim();
	if (c === "01") return "FACTURA ELECTRÓNICA";
	if (c === "03") return "BOLETA DE VENTA ELECTRÓNICA";
	const desc = String(description || "").trim();
	return desc ? desc.toUpperCase() : "NOTA DE VENTA";
}

function stripLogoBase64(logo?: string | null): string | undefined {
	if (!logo?.trim()) return undefined;
	const t = logo.trim();
	if (t.startsWith("data:")) {
		const i = t.indexOf("base64,");
		if (i >= 0) return t.slice(i + 7);
	}
	return t;
}

export function buildCashPayDocumentPreviewJson(
	input: BuildCashPayDocumentPreviewInput,
): string {
	const companyName =
		input.company?.denomination ||
		input.company?.commercialName ||
		"";
	const docLine = `${input.serial} - PREVIA`;

	const payload: Record<string, unknown> = {
		type: input.documentTypeLabel,
		branch: {
			company: companyName,
			name: input.branch.name ?? "",
			ruc: input.company?.ruc ?? "",
			address: input.branch.address ?? input.company?.address ?? "",
			phone: input.branch.phone ?? input.company?.phone ?? "",
		},
		document: {
			invoice: docLine,
			number: "VISTA PREVIA",
			date: input.emissionDate,
			time: input.emissionTime,
		},
		items: input.lineItems.map((row) => ({
			product_name: row.product_name,
			quantity: row.quantity,
			unit_price: row.unit_price,
			total: row.total,
			discount: row.discount ?? 0,
			promotion_name: row.promotion_name || "",
			notes: row.notes || "",
		})),
		amounts: {
			total_taxable: input.amounts.subtotal,
			subtotal: input.amounts.subtotal,
			igv: input.amounts.igv,
			igv_percent: input.amounts.igv_percent,
			items_discount: input.amounts.items_discount ?? 0,
			discount: input.amounts.discount,
			discount_percent: input.amounts.discount_percent,
			total_discount: input.amounts.total_discount ?? input.amounts.discount,
			total: input.amounts.total,
		},
	};

	const logo = stripLogoBase64(input.logoBase64);
	if (logo) payload.logo_base64 = logo;

	if (input.customer?.name || input.customer?.document) {
		payload.customer = {
			name: input.customer.name,
			document: input.customer.document,
			document_type: input.customer.document_type,
			address: input.customer.address,
		};
	}
	if (input.tableName) payload.table = input.tableName;
	if (input.waiterName) payload.waiter = input.waiterName;

	return JSON.stringify(payload);
}
