import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'go2pik-catering-request-store-v1';

const emptyEventDetails = {
  eventType: '',
  eventDate: '',
  eventTime: '',
  guestCount: '',
  deliveryType: 'Pickup',
  city: 'Antioch',
  pickupDateTime: '',
  instructions: '',
  organizerName: '',
  organizerEmail: '',
  organizerPhone: '',
  venueName: '',
  venueAddress: '',
  notes: '',
};

const emptyDraft = {
  eventDetails: emptyEventDetails,
  uploadedFile: null,
  items: [],
  itemUpload: {
    fileName: '',
  },
};

const CateringRequestContext = createContext(null);

function createItemId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizeItem(item) {
  const itemName = sanitizeText(item?.itemName || item?.name);
  return {
    id: item?.id || createItemId(),
    itemName,
    name: itemName,
    quantity: Math.max(1, Number(item?.quantity) || 1),
    quantityUnit: sanitizeText(item?.quantityUnit),
    serves: sanitizeText(item?.serves),
    dietType: sanitizeText(item?.dietType),
    spiceLevel: sanitizeText(item?.spiceLevel),
    notes: sanitizeText(item?.notes),
  };
}

function buildQuote(draft) {
  const eventDetails = draft?.eventDetails || {};
  const guestCount = Math.max(1, Number(eventDetails.guestCount) || 0);
  const itemCount = (draft?.items || []).reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
  const baseSubtotal = guestCount * 18;
  const itemsSubtotal = itemCount * 6.5;
  const subtotal = Math.max(baseSubtotal, itemsSubtotal, draft?.items?.length ? 75 : 0);
  const serviceFee = Math.max(25, subtotal * 0.08);
  const tax = (subtotal + serviceFee) * 0.0875;
  const total = subtotal + serviceFee + tax;

  return {
    subtotal,
    serviceFee,
    tax,
    total,
    guestCount,
    itemCount,
    note: 'Estimated pricing only. Final payment will be confirmed once the catering request is reviewed.',
  };
}

function loadStore() {
  if (typeof window === 'undefined') {
    return {
      draft: emptyDraft,
      requests: [],
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        draft: emptyDraft,
        requests: [],
      };
    }

    const parsed = JSON.parse(raw);
    return {
      draft: {
        eventDetails: {
          ...emptyEventDetails,
          ...(parsed?.draft?.eventDetails || {}),
          deliveryType: parsed?.draft?.eventDetails?.deliveryType || 'Pickup',
          city: parsed?.draft?.eventDetails?.city || 'Antioch',
        },
        uploadedFile: parsed?.draft?.uploadedFile || null,
        items: Array.isArray(parsed?.draft?.items) ? parsed.draft.items.map(normalizeItem) : [],
        itemUpload: {
          ...emptyDraft.itemUpload,
          ...(parsed?.draft?.itemUpload || {}),
        },
      },
      requests: Array.isArray(parsed?.requests)
        ? parsed.requests.map((request) => ({
            ...request,
            eventDetails: {
              ...emptyEventDetails,
              ...(request?.eventDetails || {}),
              deliveryType: request?.eventDetails?.deliveryType || 'Pickup',
              city: request?.eventDetails?.city || 'Antioch',
            },
            items: Array.isArray(request?.items) ? request.items.map(normalizeItem) : [],
          }))
        : [],
    };
  } catch {
    return {
      draft: emptyDraft,
      requests: [],
    };
  }
}

export function CateringRequestProvider({ children }) {
  const [store, setStore] = useState(() => loadStore());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const draftQuote = useMemo(() => buildQuote(store.draft), [store.draft]);

  const value = useMemo(() => {
    const requests = [...store.requests].sort((left, right) => {
      const leftTime = new Date(left?.submittedAt || 0).getTime();
      const rightTime = new Date(right?.submittedAt || 0).getTime();
      return rightTime - leftTime;
    });

    const currentDraft = {
      ...store.draft,
      eventDetails: {
        ...emptyEventDetails,
        ...(store.draft?.eventDetails || {}),
        deliveryType: store.draft?.eventDetails?.deliveryType || 'Pickup',
        city: store.draft?.eventDetails?.city || 'Antioch',
      },
      uploadedFile: store.draft?.uploadedFile || null,
      items: Array.isArray(store.draft?.items) ? store.draft.items.map(normalizeItem) : [],
      itemUpload: {
        ...emptyDraft.itemUpload,
        ...(store.draft?.itemUpload || {}),
      },
    };

    function updateEventDetails(nextDetails) {
      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          eventDetails: {
            ...current.draft.eventDetails,
            ...nextDetails,
          },
        },
      }));
    }

    function updateItemUpload(nextUpload) {
      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          itemUpload: {
            ...current.draft.itemUpload,
            ...nextUpload,
          },
        },
      }));
    }

    function setUploadedFile(uploadedFile) {
      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          uploadedFile: uploadedFile
            ? {
                name: uploadedFile.name || '',
                size: uploadedFile.size || 0,
                type: uploadedFile.type || '',
                lastModified: uploadedFile.lastModified || Date.now(),
              }
            : null,
          itemUpload: {
            ...current.draft.itemUpload,
            fileName: uploadedFile?.name || '',
          },
        },
      }));
    }

    function setItems(items) {
      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          items: Array.isArray(items) ? items.map(normalizeItem).filter((item) => item.name) : [],
        },
      }));
    }

    function addItem(item, options = {}) {
      const normalized = normalizeItem(item);
      if (!options.allowBlank && !normalized.name) {
        return;
      }

      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          items: [...current.draft.items, normalized],
        },
      }));
    }

    function updateItem(itemId, updates) {
      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          items: current.draft.items.map((item) =>
            item.id === itemId
              ? normalizeItem({
                  ...item,
                  ...updates,
                  id: item.id,
                })
              : item,
          ),
        },
      }));
    }

    function removeItem(itemId) {
      setStore((current) => ({
        ...current,
        draft: {
          ...current.draft,
          items: current.draft.items.filter((item) => item.id !== itemId),
        },
      }));
    }

    function resetDraft() {
      setStore((current) => ({
        ...current,
        draft: emptyDraft,
      }));
    }

    function submitRequest() {
      const requestId = globalThis.crypto?.randomUUID?.() || `request-${Date.now()}`;
      const timestamp = new Date().toISOString();
      const request = {
        requestId,
        status: 'submitted',
        paymentStatus: 'pending',
        submittedAt: timestamp,
        eventDetails: {
          ...currentDraft.eventDetails,
        },
        items: currentDraft.items.map(normalizeItem),
        quote: buildQuote(currentDraft),
      };

      setStore((current) => ({
        ...current,
        requests: [request, ...current.requests],
      }));

      return request;
    }

    function registerSubmittedRequest(request) {
      if (!request?.requestId) {
        return null;
      }

      const requestEntry = {
        requestId: request.requestId,
        status: request.status || 'NEW',
        paymentStatus: request.paymentStatus || 'pending',
        submittedAt: request.submittedAt || new Date().toISOString(),
        eventDetails: {
          ...currentDraft.eventDetails,
          ...(request.eventDetails || {}),
        },
        items: Array.isArray(request.items) && request.items.length ? request.items.map(normalizeItem) : currentDraft.items.map(normalizeItem),
        quote: request.quote || buildQuote(currentDraft),
      };

      setStore((current) => ({
        ...current,
        requests: [requestEntry, ...current.requests.filter((entry) => entry.requestId !== requestEntry.requestId)],
      }));

      return requestEntry;
    }

    function getRequestById(requestId) {
      return requests.find((request) => request.requestId === requestId) || null;
    }

    return {
      draft: currentDraft,
      draftQuote,
      requests,
      updateEventDetails,
      setUploadedFile,
      updateItemUpload,
      setItems,
      addItem,
      updateItem,
      removeItem,
      resetDraft,
      submitRequest,
      registerSubmittedRequest,
      getRequestById,
    };
  }, [draftQuote, store.draft, store.requests]);

  return <CateringRequestContext.Provider value={value}>{children}</CateringRequestContext.Provider>;
}

export function useCateringRequest() {
  const context = useContext(CateringRequestContext);

  if (!context) {
    throw new Error('useCateringRequest must be used within a CateringRequestProvider');
  }

  return context;
}

export { buildQuote };
