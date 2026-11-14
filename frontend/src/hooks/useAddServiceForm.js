import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost, getErrorMessage } from '../utils/api';

const todayIso = () => new Date().toISOString().split('T')[0];

const INITIAL_FORM = {
  // Core
  vehicleId: '',
  serviceDate: todayIso(),
  odometerKm: '',
  serviceCategory: 'Periodic Maintenance',
  serviceType: '',
  // Work
  laborCost: '',
  warrantyMonths: '',
  mechanicNotes: '',
  // Provider
  garageName: '',
  location: '',
  verifiedService: true,
  // Recommendations
  recommendedKm: '',
  recommendedDate: ''
};

const hasText = (value) => Boolean(value && value.trim() !== '');

/** Array state with add / remove / update-one-field helpers (immutable updates). */
function useLineItems(initial, blankRow) {
  const [items, setItems] = useState(initial);
  const add = useCallback(() => setItems((prev) => [...prev, { ...blankRow }]), [blankRow]);
  const remove = useCallback((index) => setItems((prev) => prev.filter((_, i) => i !== index)), []);
  const update = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);
  return { items, setItems, add, remove, update };
}

const BLANK_PART = { partName: '', brand: '', quantity: 1, unitPrice: '' };
const BLANK_LABOUR = { description: '', quantity: 1, rate: '' };
const BLANK_CHARGE = { description: '', amount: '' };

/** Client-side preview of the invoice totals (the server recomputes in integer paise). */
export function computeServiceTotals({ parts, labour, additionalCharges, discount, laborCost, completionMode }) {
  let partsSubtotal = 0;
  parts.forEach((p) => {
    const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
    const unitPrice = Math.max(0, parseFloat(p.unitPrice !== undefined ? p.unitPrice : (p.cost || 0)) || 0);
    partsSubtotal += qty * unitPrice;
  });

  let labourSubtotal = 0;
  if (completionMode) {
    labour.forEach((l) => {
      const qty = Math.max(1, parseFloat(l.quantity !== undefined ? l.quantity : (l.hours || 1)) || 1);
      const rate = Math.max(0, parseFloat(l.rate || 0) || 0);
      labourSubtotal += qty * rate;
    });
  } else {
    labourSubtotal = Math.max(0, parseFloat(laborCost || 0) || 0);
  }

  let additionalSubtotal = 0;
  additionalCharges.forEach((c) => {
    additionalSubtotal += Math.max(0, parseFloat(c.amount || 0) || 0);
  });

  const subtotal = partsSubtotal + labourSubtotal + additionalSubtotal;
  const discountNum = Math.max(0, parseFloat(discount || 0) || 0);
  const finalDiscount = Math.min(subtotal, discountNum);
  const taxableAmount = Math.max(0, subtotal - finalDiscount);

  // 18% GST (9% CGST + 9% SGST)
  const cgstAmount = Math.round(taxableAmount * 0.09 * 100) / 100;
  const sgstAmount = Math.round(taxableAmount * 0.09 * 100) / 100;
  const totalTax = cgstAmount + sgstAmount;
  const grandTotal = taxableAmount + totalTax;

  return {
    partsSubtotal,
    labourSubtotal,
    additionalSubtotal,
    subtotal,
    discount: finalDiscount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    totalTax,
    grandTotal
  };
}

/**
 * State, loading and submission for the Add Service / Complete Service page.
 * Completion mode (`?completionMode=true&bookingId=..&serviceId=..`) prefills from the
 * booking and posts to /services/complete; otherwise it posts a log entry to /services/add.
 */
export function useAddServiceForm({ completionMode, bookingId, serviceId, isGarage, billPhotos, showToast }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesError, setVehiclesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [prefilledData, setPrefilledData] = useState(null);
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(completionMode);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const parts = useLineItems([], BLANK_PART);
  const labour = useLineItems([{ description: 'General Service Labour', quantity: 1, rate: '' }], BLANK_LABOUR);
  const charges = useLineItems([], BLANK_CHARGE);
  const [discount, setDiscount] = useState('');

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const submittingRef = useRef(false);
  const setLabourItems = labour.setItems;

  // ── Load completion details (prefill) and the selectable vehicles ──────────
  useEffect(() => {
    let cancelled = false;

    const initPage = async () => {
      if (completionMode && (bookingId || serviceId)) {
        setIsLoadingPrefill(true);
        try {
          const d = await apiGet('/services/completion-details', { bookingId, serviceId });
          if (!cancelled && d?.success) {
            setPrefilledData(d);
            setFormData((prev) => ({
              ...prev,
              vehicleId: d.vehicle?.id || '',
              odometerKm: d.vehicle?.currentOdometerKm || d.service?.odometer || '',
              serviceDate: d.service?.date || todayIso(),
              serviceCategory: d.service?.category || 'Periodic Maintenance',
              serviceType: d.service?.title || 'General Service',
              garageName: d.garage?.name || '',
              location: d.garage?.location || ''
            }));
            if (d.service?.price) {
              setLabourItems([{ description: `${d.service?.title || 'Service'} Labour`, quantity: 1, rate: String(d.service?.price) }]);
            }
          }
        } catch (err) {
          console.error('Error fetching completion details:', err);
          if (!cancelled) showToast('Could not load booking details for prefill', 'error');
        } finally {
          if (!cancelled) setIsLoadingPrefill(false);
        }
      }

      // Load vehicle list as fallback/choice
      try {
        const vehicleList = await apiGet(isGarage ? '/vehicles/all' : '/vehicles/myvehicles');
        if (cancelled) return;
        setVehicles(vehicleList || []);
        setVehiclesError('');

        if (!completionMode && vehicleList?.length > 0) {
          setFormData((prev) => ({ ...prev, vehicleId: prev.vehicleId || vehicleList[0].id }));
        }

        if (isGarage && !completionMode) {
          try {
            const garage = await apiGet('/garages/me');
            if (!cancelled && garage && garage.exists) {
              setFormData((prev) => ({ ...prev, garageName: garage.name || '', location: garage.city || '' }));
            }
          } catch (gErr) {
            console.error('Error loading garage profile:', gErr);
          }
        }
      } catch (err) {
        console.error('Error loading vehicles:', err);
        if (!cancelled) setVehiclesError(getErrorMessage(err, 'Could not load vehicles.'));
      }
    };

    initPage();
    return () => { cancelled = true; };
  }, [completionMode, bookingId, serviceId, isGarage, showToast, setLabourItems, reloadKey]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const financialTotals = useMemo(() => computeServiceTotals({
    parts: parts.items,
    labour: labour.items,
    additionalCharges: charges.items,
    discount,
    laborCost: formData.laborCost,
    completionMode
  }), [parts.items, labour.items, charges.items, discount, formData.laborCost, completionMode]);

  // ── Submission ──────────────────────────────────────────────────────────────
  const executeSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStatus({ type: '', message: '' });
    setShowConfirmModal(false);
    setIsLoading(true);

    try {
      if (completionMode) {
        // Complete Service & Generate Final Invoice
        const completePayload = {
          bookingId,
          serviceId,
          vehicleId: formData.vehicleId,
          odometer: formData.odometerKm,
          odometerKm: formData.odometerKm,
          serviceDate: formData.serviceDate,
          serviceCategory: formData.serviceCategory,
          serviceType: formData.serviceType,
          mechanicNotes: formData.mechanicNotes,
          parts: parts.items.filter((p) => hasText(p.partName)),
          labour: labour.items.filter((l) => hasText(l.description)),
          additionalCharges: charges.items.filter((c) => hasText(c.description)),
          discount: parseFloat(discount) || 0,
          warrantyMonths: formData.warrantyMonths,
          recommendedKm: formData.recommendedKm,
          recommendedDate: formData.recommendedDate,
          billPhotoUrls: billPhotos
        };

        const data = await apiPost('/services/complete', completePayload);
        if (data?.success) {
          setSuccessResult(data);
          showToast(`Service completed! Invoice ${data.invoiceNumber} generated.`, 'success');
        } else {
          throw new Error(data?.message || 'Failed to complete service');
        }
      } else {
        // Regular service log entry
        const submitPayload = {
          ...formData,
          partsReplaced: parts.items.filter((p) => hasText(p.partName)),
          billPhotoUrls: billPhotos
        };

        const data = await apiPost('/services/add', submitPayload);
        setStatus({ type: 'success', message: 'Service logged successfully!' });
        showToast('Service logged successfully!', 'success');
        setSuccessResult({ isLogOnly: true, serviceId: data.serviceId, invoiceNumber: null });
      }
    } catch (err) {
      console.error('Error logging/completing service:', err);
      setStatus({ type: 'error', message: getErrorMessage(err, 'Failed to complete service. Please try again.') });
      showToast(getErrorMessage(err, 'Operation failed'), 'error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!formData.vehicleId) {
      setStatus({ type: 'error', message: 'Please select or verify the vehicle' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // In completion mode, show confirmation modal instead of submitting directly
    if (completionMode) {
      setShowConfirmModal(true);
      return;
    }

    executeSubmit();
  };

  return {
    vehicles,
    vehiclesError,
    reloadVehicles: () => setReloadKey((k) => k + 1),
    prefilledData,
    isLoadingPrefill,
    formData,
    handleChange,
    parts,
    labour,
    charges,
    discount,
    setDiscount,
    financialTotals,
    status,
    isLoading,
    successResult,
    showConfirmModal,
    setShowConfirmModal,
    handleSubmit,
    executeSubmit,
  };
}

export default useAddServiceForm;
