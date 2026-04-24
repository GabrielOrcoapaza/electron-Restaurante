import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useAuth } from './useAuth';
import { GET_DEVICE_PRINT_INTEGRATION } from '../graphql/queries';
import { setIntegratedPrinterCashUiEnabled } from '../utils/localPrinterPreference';

/**
 * Lee DevicePrintConfig vía GraphQL y alinea localStorage con el admin de Django
 * (use_integrated_printer). Debe montarse una vez con sesión activa (p. ej. layout del dashboard).
 *
 * Requiere en el API: devicePrintIntegration(branchId, deviceId) { useIntegratedPrinter }
 */
export function useIntegratedPrinterSyncFromServer(): void {
	const { companyData, getMacAddress, getDeviceId } = useAuth();
	const [deviceId, setDeviceId] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const mac = await getMacAddress();
				if (!cancelled && mac && String(mac).trim() !== '') {
					setDeviceId(String(mac).trim());
					return;
				}
			} catch {
				/* ignorar */
			}
			if (!cancelled) setDeviceId(getDeviceId());
		})();
		return () => {
			cancelled = true;
		};
	}, [getMacAddress, getDeviceId]);

	const { data, error } = useQuery(GET_DEVICE_PRINT_INTEGRATION, {
		variables: {
			branchId: companyData?.branch?.id ?? '',
			deviceId: deviceId ?? ''
		},
		skip: !companyData?.branch?.id || !deviceId,
		fetchPolicy: 'cache-and-network',
		errorPolicy: 'all'
	});

	useEffect(() => {
		if (error) return;
		const v = data?.devicePrintIntegration?.useIntegratedPrinter;
		if (typeof v === 'boolean') {
			setIntegratedPrinterCashUiEnabled(v);
		}
	}, [data, error]);
}
