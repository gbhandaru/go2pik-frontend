import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  approveMenuImport,
  getMenuImport,
  parseMenuImport,
  reparseMenuImport,
  uploadAndOcrMenu,
} from '../api/menuImportApi.js';
import { normalizeAppError } from '../utils/appError.js';
import { getKitchenRestaurantId } from '../services/authStorage.js';

const LOADING_STEPS = ['Reading menu...', 'Understanding items...', 'Organizing categories...', 'Almost ready...'];
const MENU_ROUTE = '/kitchen/menu';

function createEmptyItem() {
  return {
    name: '',
    description: '',
    price: null,
    isVegetarian: null,
    isDuplicate: false,
  };
}

function createEmptyCategory() {
  return {
    name: '',
    items: [createEmptyItem()],
  };
}

function createDefaultParsedJson() {
  return {
    categories: [createEmptyCategory()],
  };
}

function normalizePrice(value) {
  if (value === '' || value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeParsedJson(parsedJson) {
  const categories = Array.isArray(parsedJson?.categories) ? parsedJson.categories : [];

  if (!categories.length) {
    return createDefaultParsedJson();
  }

  return {
    categories: categories.map((category) => {
      const items = Array.isArray(category?.items) ? category.items : [];
      return {
        name: String(category?.name || '').trim(),
        items: items.length
          ? items.map((item) => ({
              name: String(item?.name || '').trim(),
              description: String(item?.description || '').trim(),
              price: normalizePrice(item?.price),
              isVegetarian:
                typeof item?.isVegetarian === 'boolean' ? item.isVegetarian : item?.isVegetarian ?? null,
              // TODO: have backend return a deterministic duplicate flag for each item.
              isDuplicate: Boolean(item?.isDuplicate ?? item?.is_duplicate ?? false),
            }))
          : [createEmptyItem()],
      };
    }),
  };
}

function toSubmissionParsedJson(parsedJson) {
  return {
    categories: (Array.isArray(parsedJson?.categories) ? parsedJson.categories : []).map((category) => ({
      name: String(category?.name || '').trim(),
      items: (Array.isArray(category?.items) ? category.items : []).map((item) => ({
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim(),
        price: normalizePrice(item?.price),
        isVegetarian:
          typeof item?.isVegetarian === 'boolean' ? item.isVegetarian : item?.isVegetarian ?? null,
      })),
    })),
  };
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function resolveMenuPreviewUrl(fileUrl) {
  const value = String(fileUrl || '').trim();
  if (!value) {
    return '';
  }

  if (isHttpUrl(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (value.startsWith('gs://')) {
    // TODO: if the bucket is private, use a signed/public media endpoint from the backend instead.
    const withoutScheme = value.slice('gs://'.length);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex > 0) {
      const bucket = withoutScheme.slice(0, slashIndex);
      const objectPath = withoutScheme.slice(slashIndex + 1);
      return `https://storage.googleapis.com/${bucket}/${objectPath}`;
    }
  }

  return value;
}

function getDetectionReasons(response) {
  const candidates = [
    response?.detectionReasons,
    response?.detection_reasons,
    response?.reasons,
    response?.details,
    response?.message,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      return [candidate.trim()];
    }
  }

  return [];
}

function validateParsedJson(parsedJson) {
  const errors = [];
  const categories = Array.isArray(parsedJson?.categories) ? parsedJson.categories : [];

  if (!categories.length) {
    errors.push('Add at least one category.');
    return errors;
  }

  let validItemCount = 0;

  categories.forEach((category, categoryIndex) => {
    const items = Array.isArray(category?.items) ? category.items : [];

    if (!items.length) {
      errors.push(`Category ${categoryIndex + 1} needs at least one item.`);
      return;
    }

    items.forEach((item, itemIndex) => {
      const name = String(item?.name || '').trim();
      const price = normalizePrice(item?.price);
      const hasValidPrice = price == null || (Number.isFinite(price) && price >= 0);

      if (!name) {
        errors.push(`Item ${categoryIndex + 1}.${itemIndex + 1} needs a name.`);
      }

      if (!hasValidPrice) {
        errors.push(`Item ${categoryIndex + 1}.${itemIndex + 1} has an invalid price.`);
      }

      if (name && hasValidPrice) {
        validItemCount += 1;
      }
    });
  });

  if (!validItemCount) {
    errors.push('Add at least one valid item.');
  }

  return errors;
}

function formatSuccessMessage(response) {
  const categoriesInserted = Number(response?.categoriesInserted || 0);
  const itemsInserted = Number(response?.itemsInserted || 0);
  const skippedItems = Number(response?.skippedItems || 0);

  if (itemsInserted === 0 && skippedItems > 0) {
    return 'Menu already up to date. All items already exist.';
  }

  if (itemsInserted > 0 && skippedItems > 0) {
    return `${itemsInserted} new items added, ${skippedItems} already existed.`;
  }

  if (itemsInserted > 0 && skippedItems === 0) {
    return `Menu saved successfully. ${itemsInserted} items added.`;
  }

  return 'No valid menu items found.';
}

function buildSuccessSummary(response) {
  const categoriesInserted = Number(response?.categoriesInserted || 0);
  const itemsInserted = Number(response?.itemsInserted || 0);
  const skippedItems = Number(response?.skippedItems || 0);

  return {
    categoriesInserted,
    itemsInserted,
    skippedItems,
    message: formatSuccessMessage(response),
  };
}

function MenuImportBanner({ tone = 'info', message, details = [] }) {
  if (!message) {
    return null;
  }

  return (
    <section className={`menu-import-banner menu-import-banner--${tone}`} role="status" aria-live="polite">
      <strong>{message}</strong>
      {details.length ? (
        <ul className="menu-import-banner__details">
          {details.map((detail, index) => (
            <li key={`${tone}-${index}`}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function RestaurantMenuImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const loadingTimerRef = useRef(null);
  const successRedirectRef = useRef(null);
  const [restaurantId, setRestaurantId] = useState('');
  const [usingFallbackRestaurantId, setUsingFallbackRestaurantId] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importId, setImportId] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');
  const [parsedJson, setParsedJson] = useState(createDefaultParsedJson());
  const [stage, setStage] = useState('upload');
  const [loadingMode, setLoadingMode] = useState(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [banner, setBanner] = useState(null);
  const [successSummary, setSuccessSummary] = useState(null);

  useEffect(() => {
    const resolvedRestaurantId = getKitchenRestaurantId();
    if (resolvedRestaurantId) {
      setRestaurantId(resolvedRestaurantId);
      setUsingFallbackRestaurantId(false);
      return;
    }

    // TODO: wire restaurant context/auth state into this page so the fallback is no longer needed.
    setRestaurantId('1');
    setUsingFallbackRestaurantId(true);
  }, []);

  const categoryCount = useMemo(() => parsedJson.categories.length, [parsedJson]);
  const itemCount = useMemo(
    () =>
      parsedJson.categories.reduce(
        (count, category) => count + (Array.isArray(category.items) ? category.items.length : 0),
        0,
      ),
    [parsedJson],
  );
  const loadingStep = LOADING_STEPS[loadingStepIndex % LOADING_STEPS.length];
  const previewUrl = useMemo(() => resolveMenuPreviewUrl(fileUrl), [fileUrl]);

  useEffect(() => {
    if (!loadingMode) {
      setLoadingStepIndex(0);
      return undefined;
    }

    setLoadingStepIndex(0);
    loadingTimerRef.current = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % LOADING_STEPS.length);
    }, 1500);

    return () => {
      if (loadingTimerRef.current) {
        window.clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [loadingMode]);

  useEffect(() => {
    if (stage !== 'success') {
      return undefined;
    }

    successRedirectRef.current = window.setTimeout(() => {
      navigate(MENU_ROUTE, { replace: true });
    }, 3000);

    return () => {
      if (successRedirectRef.current) {
        window.clearTimeout(successRedirectRef.current);
        successRedirectRef.current = null;
      }
    };
  }, [navigate, stage]);

  const resetImport = () => {
    if (loadingTimerRef.current) {
      window.clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    if (successRedirectRef.current) {
      window.clearTimeout(successRedirectRef.current);
      successRedirectRef.current = null;
    }

    setSelectedFile(null);
    setImportId(null);
    setFileUrl('');
    setRawOcrText('');
    setParsedJson(createDefaultParsedJson());
    setStage('upload');
    setLoading(false);
    setApproving(false);
    setReparsing(false);
    setLoadingMode(null);
    setBanner(null);
    setSuccessSummary(null);
    setLoadingStepIndex(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSelectedFile(nextFile);
    setBanner(null);
  };

  const updateCategoryName = (categoryIndex, value) => {
    setParsedJson((current) => ({
      categories: current.categories.map((category, index) =>
        index === categoryIndex ? { ...category, name: value } : category,
      ),
    }));
  };

  const updateItemField = (categoryIndex, itemIndex, field, value) => {
    setParsedJson((current) => ({
      categories: current.categories.map((category, index) => {
        if (index !== categoryIndex) {
          return category;
        }

        return {
          ...category,
          items: category.items.map((item, currentItemIndex) => {
            if (currentItemIndex !== itemIndex) {
              return item;
            }

            return {
              ...item,
              [field]: field === 'price' ? normalizePrice(value) : value,
            };
          }),
        };
      }),
    }));
  };

  const addCategory = () => {
    setParsedJson((current) => ({
      categories: [...current.categories, createEmptyCategory()],
    }));
  };

  const deleteCategory = (categoryIndex) => {
    setParsedJson((current) => {
      if (current.categories.length <= 1) {
        return createDefaultParsedJson();
      }

      return {
        categories: current.categories.filter((_, index) => index !== categoryIndex),
      };
    });
  };

  const addItem = (categoryIndex) => {
    setParsedJson((current) => ({
      categories: current.categories.map((category, index) =>
        index === categoryIndex
          ? { ...category, items: [...category.items, createEmptyItem()] }
          : category,
      ),
    }));
  };

  const deleteItem = (categoryIndex, itemIndex) => {
    setParsedJson((current) => ({
      categories: current.categories.map((category, index) => {
        if (index !== categoryIndex) {
          return category;
        }

        const nextItems = category.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex);
        return {
          ...category,
          items: nextItems.length ? nextItems : [createEmptyItem()],
        };
      }),
    }));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setBanner({
        tone: 'error',
        message: 'Please choose a menu image or PDF first.',
      });
      return;
    }

    setBanner(null);
    setLoading(true);
    setLoadingMode('upload');
    setStage('processing');

    try {
      const uploadResponse = await uploadAndOcrMenu(selectedFile, restaurantId);
      const nextImportId = uploadResponse?.importId ?? uploadResponse?.id ?? null;
      const nextRawText = String(uploadResponse?.rawOcrText || '').trim();
      const nextFileUrl = String(uploadResponse?.fileUrl || '').trim();

      setImportId(nextImportId);
      setFileUrl(nextFileUrl);
      setRawOcrText(nextRawText);

      if (!nextImportId || !nextRawText || uploadResponse?.status !== 'OCR_COMPLETED') {
        setStage('warning');
        setBanner({
          tone: 'warning',
          message: 'Could not read this file. Try a clearer image.',
        });
        return;
      }

      try {
        const parseResponse = await parseMenuImport(nextImportId);

        if (parseResponse?.isMenu === false) {
          setStage('warning');
          setBanner({
            tone: 'warning',
            message:
              'This file does not look like a restaurant menu. Please upload a clear menu image or PDF.',
            details: getDetectionReasons(parseResponse),
          });
          return;
        }

        const nextParsedJson = normalizeParsedJson(parseResponse?.parsedJson);
        setParsedJson(nextParsedJson);
        setFileUrl(String(parseResponse?.fileUrl || nextFileUrl || '').trim() || nextFileUrl);
        setStage('review');
      } catch (error) {
        const normalized = normalizeAppError(error);
        setStage('upload');
        setImportId(null);
        setFileUrl('');
        setRawOcrText('');
        setParsedJson(createDefaultParsedJson());
        setBanner({
          tone: 'error',
          message:
            normalized.kind === 'validation'
              ? 'Could not parse menu items. Please try another file.'
              : 'Could not parse menu items. Please try another file.',
        });
      }
    } catch (error) {
      setStage('upload');
      setImportId(null);
      setFileUrl('');
      setRawOcrText('');
      setParsedJson(createDefaultParsedJson());
      setBanner({
        tone: 'error',
        message: 'Unable to upload menu. Please try again.',
      });
    } finally {
      setLoading(false);
      setLoadingMode(null);
    }
  };

  const handleApprove = async () => {
    const validationErrors = validateParsedJson(parsedJson);
    if (validationErrors.length) {
      setBanner({
        tone: 'error',
        message: validationErrors[0],
        details: validationErrors.slice(1),
      });
      return;
    }

    if (!importId) {
      setBanner({
        tone: 'error',
        message: 'Missing menu import context. Please upload the file again.',
      });
      return;
    }

    setApproving(true);
    setBanner(null);

    try {
      const response = await approveMenuImport(importId, toSubmissionParsedJson(parsedJson));
      setSuccessSummary(buildSuccessSummary(response));
      setStage('success');
    } catch (error) {
      const normalized = normalizeAppError(error);
      setBanner({
        tone: 'error',
        message: normalized.kind === 'validation' ? normalized.message : 'Unable to save menu. Please try again.',
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReparse = async () => {
    if (!importId) {
      setBanner({
        tone: 'error',
        message: 'Missing menu import context. Please upload the file again.',
      });
      return;
    }

    setBanner(null);
    setReparsing(true);
    setLoadingMode('reparse');

    try {
      const response = await reparseMenuImport(importId);
      const nextParsedJson = response?.parsedJson ? normalizeParsedJson(response.parsedJson) : null;

      if (nextParsedJson) {
        setParsedJson(nextParsedJson);
      } else {
        const refreshed = await getMenuImport(importId);
        setParsedJson(normalizeParsedJson(refreshed?.parsedJson));
        setRawOcrText(String(refreshed?.rawOcrText || rawOcrText || '').trim());
        setFileUrl(String(refreshed?.fileUrl || fileUrl || '').trim());
      }
    } catch (error) {
      const normalized = normalizeAppError(error);
      setBanner({
        tone: 'error',
        message: normalized.kind === 'not_found' ? 'Could not re-parse this menu. Please upload it again.' : 'Could not re-parse menu items. Please try again.',
      });
    } finally {
      setReparsing(false);
      setLoadingMode(null);
    }
  };

  const renderUploadState = () => (
    <>
      <section className="card menu-import-hero">
        <div className="menu-import-hero__copy">
          <p className="eyebrow">Restaurant Dashboard</p>
          <h1>AI Menu Import</h1>
          <p className="menu-import-hero__subtitle">
            Upload a menu photo or PDF. Go2Pik will extract items and prices automatically.
          </p>
        </div>
        <div className="menu-import-hero__meta">
          <span className="menu-import-pill">Restaurant ID: {restaurantId || '—'}</span>
          {usingFallbackRestaurantId ? <span className="menu-import-pill menu-import-pill--muted">Using fallback ID</span> : null}
        </div>
      </section>

      <section className="menu-import-shell">
        <div className="card menu-import-panel">
          <MenuImportBanner tone={banner?.tone} message={banner?.message} details={banner?.details} />
          <label className="form-group">
            Menu file
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
            />
          </label>
          <p className="muted menu-import-help">
            Supported formats: JPG, JPEG, PNG, PDF.
          </p>
          {selectedFile ? (
            <div className="menu-import-summary-item menu-import-summary-item--file">
              <span>Selected file</span>
              <strong>{selectedFile.name}</strong>
            </div>
          ) : null}
          <button
            type="button"
            className="primary-btn emphasis"
            onClick={handleUpload}
            disabled={loading || approving || !selectedFile}
          >
            {loading ? loadingStep : 'Upload & Scan Menu'}
          </button>
        </div>

        <aside className="card menu-import-panel">
          <h2>What happens next</h2>
          <div className="menu-import-summary-list">
            <div className="menu-import-summary-item">
              <span>1. Upload</span>
              <strong>Send a menu image or PDF</strong>
            </div>
            <div className="menu-import-summary-item">
              <span>2. OCR</span>
              <strong>Read the text automatically</strong>
            </div>
            <div className="menu-import-summary-item">
              <span>3. Review</span>
              <strong>Edit categories and prices</strong>
            </div>
            <div className="menu-import-summary-item">
              <span>4. Save</span>
              <strong>Approve and update your menu</strong>
            </div>
          </div>
        </aside>
      </section>
    </>
  );

  const renderProcessingState = () => (
    <section className="card menu-import-processing">
      <p className="eyebrow">Working</p>
      <h1>{loadingStep}</h1>
      <p className="muted">
        Please keep this tab open while Go2Pik reads the menu and prepares the review draft.
      </p>
    </section>
  );

  const renderWarningState = () => (
    <>
      <section className="card menu-import-hero">
        <div className="menu-import-hero__copy">
          <p className="eyebrow">Restaurant Dashboard</p>
          <h1>AI Menu Import</h1>
          <p className="menu-import-hero__subtitle">We could not confidently detect a restaurant menu.</p>
        </div>
        <div className="menu-import-hero__meta">
          <span className="menu-import-pill">Import ID: {importId || '—'}</span>
        </div>
      </section>

      <section className="menu-import-shell">
        <div className="card menu-import-panel">
          <MenuImportBanner tone={banner?.tone} message={banner?.message} details={banner?.details} />
          {rawOcrText ? (
            <details className="menu-import-ocr">
              <summary>Raw OCR text</summary>
              <pre>{rawOcrText}</pre>
            </details>
          ) : null}
          <div className="menu-import-actions">
            <button type="button" className="primary-btn secondary" onClick={resetImport}>
              Upload another
            </button>
          </div>
        </div>

        <aside className="card menu-import-panel">
          <h2>Tips for better results</h2>
          <div className="menu-import-summary-list">
            <div className="menu-import-summary-item">
              <span>Use</span>
              <strong>A clear, well-lit menu photo</strong>
            </div>
            <div className="menu-import-summary-item">
              <span>Prefer</span>
              <strong>A PDF or a straight-on image</strong>
            </div>
            <div className="menu-import-summary-item">
              <span>Avoid</span>
              <strong>Blurry, cropped, or angled photos</strong>
            </div>
          </div>
        </aside>
      </section>
    </>
  );

  const renderReviewState = () => (
    <>
      <section className="card menu-import-hero">
        <div className="menu-import-hero__copy">
          <p className="eyebrow">Restaurant Dashboard</p>
          <h1>Review menu import</h1>
          <p className="menu-import-hero__subtitle">
            Check the OCR output, edit the categories, and approve the final menu.
          </p>
        </div>
        <div className="menu-import-hero__meta">
          <span className="menu-import-pill">Import ID: {importId || '—'}</span>
          <span className="menu-import-pill">Categories: {categoryCount}</span>
          <span className="menu-import-pill">Items: {itemCount}</span>
        </div>
      </section>

      <section className="menu-import-shell">
        <aside className="card menu-import-panel menu-import-panel--sticky">
          {reparsing ? <MenuImportBanner tone="info" message={loadingStep} /> : null}
          {!reparsing ? <MenuImportBanner tone={banner?.tone} message={banner?.message} details={banner?.details} /> : null}
          <div className="menu-import-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Uploaded menu preview" className="menu-import-preview__image" />
            ) : (
              <div className="menu-import-preview__placeholder">
                <strong>Image preview</strong>
                <span>Preview will appear here after upload.</span>
              </div>
            )}
          </div>
          <details className="menu-import-ocr">
            <summary>Raw OCR text</summary>
            <pre>{rawOcrText || 'No OCR text available.'}</pre>
          </details>

          <div className="menu-import-actions">
            <button
              type="button"
              className="primary-btn secondary"
              onClick={handleReparse}
              disabled={loading || approving || reparsing || !importId}
            >
              {reparsing ? 'Re-parsing Menu...' : 'Re-parse Menu'}
            </button>
            <button type="button" className="primary-btn secondary" onClick={resetImport} disabled={loading || approving || reparsing}>
              Upload another
            </button>
            <button type="button" className="primary-btn emphasis" onClick={handleApprove} disabled={loading || approving || reparsing}>
              {approving ? 'Saving menu...' : 'Approve & Save Menu'}
            </button>
          </div>
        </aside>

        <section className="card menu-import-panel menu-import-review">
          <div className="menu-import-review__toolbar">
            <div>
              <p className="eyebrow">Parsed menu</p>
              <h2>Categories and items</h2>
            </div>
            <button type="button" className="primary-btn secondary" onClick={addCategory} disabled={approving}>
              Add Category
            </button>
          </div>

          <div className="menu-import-categories">
            {parsedJson.categories.map((category, categoryIndex) => (
              <article key={`category-${categoryIndex}`} className="menu-import-category">
                <div className="menu-import-category__header">
                  <label className="form-group menu-import-category__name">
                    Category name
                    <input
                      type="text"
                      value={category.name}
                      onChange={(event) => updateCategoryName(categoryIndex, event.target.value)}
                      placeholder="Biryani"
                      disabled={approving}
                    />
                  </label>

                  <button
                    type="button"
                    className="primary-btn danger menu-import-small-btn"
                    onClick={() => deleteCategory(categoryIndex)}
                    disabled={approving}
                  >
                    Delete category
                  </button>
                </div>

                <div className="menu-import-items">
                  {category.items.map((item, itemIndex) => (
                    <div key={`item-${categoryIndex}-${itemIndex}`} className="menu-import-item">
                      <div className="menu-import-item__header">
                        <span className={`menu-import-item__badge${item.isDuplicate ? ' menu-import-item__badge--duplicate' : ' menu-import-item__badge--new'}`}>
                          {item.isDuplicate ? 'Already exists' : 'New'}
                        </span>
                      </div>
                      <label className="form-group">
                        Item name
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) => updateItemField(categoryIndex, itemIndex, 'name', event.target.value)}
                          placeholder="Chicken Biryani"
                          disabled={approving}
                        />
                      </label>

                      <label className="form-group">
                        Price
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={item.price == null ? '' : item.price}
                          onChange={(event) => updateItemField(categoryIndex, itemIndex, 'price', event.target.value)}
                          placeholder="12.99"
                          disabled={approving}
                        />
                      </label>

                      <label className="form-group menu-import-item__description">
                        Description
                        <input
                          type="text"
                          value={item.description}
                          onChange={(event) =>
                            updateItemField(categoryIndex, itemIndex, 'description', event.target.value)
                          }
                          placeholder="Aromatic basmati rice with chicken"
                          disabled={approving}
                        />
                      </label>

                      <label className="menu-import-item__switch">
                        <span>Vegetarian</span>
                        <input
                          type="checkbox"
                          checked={item.isVegetarian === true}
                          onChange={(event) =>
                            updateItemField(categoryIndex, itemIndex, 'isVegetarian', event.target.checked)
                          }
                          disabled={approving}
                        />
                      </label>

                      <button
                        type="button"
                        className="primary-btn danger menu-import-small-btn"
                        onClick={() => deleteItem(categoryIndex, itemIndex)}
                        disabled={approving}
                      >
                        Delete item
                      </button>
                    </div>
                  ))}
                </div>

                <div className="menu-import-category__footer">
                  <button
                    type="button"
                    className="primary-btn secondary menu-import-small-btn"
                    onClick={() => addItem(categoryIndex)}
                    disabled={approving}
                  >
                    Add item
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );

  const renderSuccessState = () => (
    <section className="card menu-import-success">
      <p className="eyebrow">Complete</p>
      <h1>{successSummary?.message || 'Menu saved successfully.'}</h1>
      <p className="muted">Import finished. You can view the menu or upload another file.</p>

      <div className="menu-import-summary-list">
        <div className="menu-import-summary-item">
          <span>Categories inserted</span>
          <strong>{successSummary?.categoriesInserted ?? 0}</strong>
        </div>
        <div className="menu-import-summary-item">
          <span>Items inserted</span>
          <strong>{successSummary?.itemsInserted ?? 0}</strong>
        </div>
        <div className="menu-import-summary-item">
          <span>Skipped items</span>
          <strong>{successSummary?.skippedItems ?? 0}</strong>
        </div>
      </div>

      <div className="menu-import-actions">
        <button type="button" className="primary-btn secondary" onClick={() => navigate(MENU_ROUTE, { replace: true })}>
          View Menu
        </button>
        <button type="button" className="primary-btn emphasis" onClick={resetImport}>
          Upload another
        </button>
      </div>
    </section>
  );

  return (
    <main className="page-section kitchen-page menu-import-page">
      {stage === 'processing'
        ? renderProcessingState()
        : stage === 'warning'
          ? renderWarningState()
          : stage === 'review'
            ? renderReviewState()
            : stage === 'success'
              ? renderSuccessState()
              : renderUploadState()}
    </main>
  );
}
