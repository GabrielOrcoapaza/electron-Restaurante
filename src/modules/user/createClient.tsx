import React, { useState } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { CREATE_PERSON } from '../../graphql/mutations';
import { SEARCH_PERSON_BY_DOCUMENT } from '../../graphql/queries';

type CreateClientProps = {
  onSuccess?: (clientId: string) => void;
  onClose: () => void;
};

const inputClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 sm:px-3.5 sm:py-2.5';

const labelClassName =
  'mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300 sm:text-sm';

const CreateClient: React.FC<CreateClientProps> = ({ onSuccess, onClose }) => {
  const { companyData } = useAuth();

  const [formData, setFormData] = useState<{
    name: string;
    documentType: string;
    documentNumber: string;
    email: string;
    phone: string;
    address: string;
  }>({
    name: '',
    documentType: 'DNI',
    documentNumber: '',
    email: '',
    phone: '',
    address: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [searchPerson, { loading: searchLoading }] = useLazyQuery(SEARCH_PERSON_BY_DOCUMENT, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      const result = data?.searchPersonByDocument;
      if (result?.person) {
        const person = result.person;
        setFormData(prev => ({
          ...prev,
          name: person.name || '',
          email: person.email || prev.email,
          phone: person.phone || prev.phone,
          address: person.address || prev.address
        }));

        let msg = '';
        if (result.foundInSunat) {
          msg = '✅ Datos obtenidos de SUNAT';
        } else if (result.foundLocally) {
          msg = '⚠️ Cliente ya registrado en el sistema';
        }

        if (msg) {
          setMessage({ type: 'success', text: msg });
        }
      }
    },
    onError: (err) => {
      console.error("Error buscando persona:", err);
    }
  });

  const handleSearchPerson = () => {
    const docNum = formData.documentNumber.trim();
    const docType = formData.documentType;

    if (!companyData?.branch?.id) {
      setMessage({ type: 'error', text: 'No se encontró información de la sucursal' });
      return;
    }

    if (docType === 'DNI' && docNum.length !== 8) {
      setMessage({ type: 'error', text: 'El DNI debe tener 8 dígitos' });
      return;
    }

    if (docType === 'RUC' && docNum.length !== 11) {
      setMessage({ type: 'error', text: 'El RUC debe tener 11 dígitos' });
      return;
    }

    if (!docNum) {
      setMessage({ type: 'error', text: 'Ingrese el número de documento' });
      return;
    }

    searchPerson({
      variables: {
        documentType: docType,
        documentNumber: docNum,
        branchId: companyData.branch.id
      }
    });
  };

  const [createPerson, { loading }] = useMutation(CREATE_PERSON, {
    onCompleted: (data) => {
      if (data.createPerson.success) {
        setMessage({ type: 'success', text: data.createPerson.message || 'Cliente creado exitosamente' });
        if (onSuccess && data.createPerson.person) {
          setTimeout(() => {
            onSuccess(data.createPerson.person.id);
            onClose();
          }, 1000);
        }
      } else {
        setMessage({ type: 'error', text: data.createPerson.message || 'Error al crear el cliente' });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message || 'Error al crear el cliente' });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'documentNumber' || name === 'documentType') {
      setMessage(null);
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre es requerido' });
      return;
    }
    if (!formData.documentNumber.trim()) {
      setMessage({ type: 'error', text: 'El número de documento es requerido' });
      return;
    }

    if (!companyData?.branch?.id) {
      setMessage({ type: 'error', text: 'No se encontró información de la sucursal' });
      return;
    }

    try {
      await createPerson({
        variables: {
          branchId: companyData.branch.id,
          name: formData.name.trim(),
          documentType: formData.documentType,
          documentNumber: formData.documentNumber.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          isCustomer: true,
          isSupplier: false
        }
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al crear el cliente' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-[95%] overflow-auto rounded-xl bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900 sm:max-w-[450px] md:max-w-[500px] lg:max-w-[550px] xl:max-w-[600px] max-h-[90vh] p-4 sm:p-5 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between sm:mb-5 md:mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-[1.375rem] md:text-2xl">
            Nuevo Cliente
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ×
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2.5 text-xs sm:text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className={labelClassName}>
              Tipo de Documento *
            </label>
            <select
              name="documentType"
              value={formData.documentType}
              onChange={handleChange}
              required
              className={inputClassName}
            >
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
              <option value="CE">Carné de Extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </div>

          <div className="mb-4">
            <label className={labelClassName}>
              Número de Documento *
            </label>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                name="documentNumber"
                value={formData.documentNumber}
                onChange={handleChange}
                required
                className={`${inputClassName} flex-1 ${searchLoading ? 'border-indigo-500 dark:border-indigo-400' : ''}`}
              />
              <button
                type="button"
                onClick={handleSearchPerson}
                disabled={searchLoading || !formData.documentNumber.trim()}
                className="min-w-[80px] whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-600 sm:text-sm"
              >
                {searchLoading ? '🔍...' : '🔍 Buscar'}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className={labelClassName}>
              Nombre Completo *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={inputClassName}
            />
          </div>

          <div className="mb-4">
            <label className={labelClassName}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputClassName}
            />
          </div>

          <div className="mb-4">
            <label className={labelClassName}>
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={inputClassName}
            />
          </div>

          <div className="mb-5 sm:mb-6">
            <label className={labelClassName}>
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-600 sm:w-auto"
            >
              {loading ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateClient;
