import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KitchenTabs from '../components/kitchen/KitchenTabs.jsx';
import {
  createKitchenMenuCategory,
  createKitchenMenuItem,
  deleteKitchenMenuItem,
  fetchKitchenMenuCategories,
  fetchKitchenMenuExport,
  fetchKitchenMenuItems,
  importKitchenMenu,
  toggleKitchenMenuItemAvailability,
  updateKitchenMenuCategory,
  updateKitchenMenuItem,
} from '../api/kitchenMenuApi.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getKitchenRestaurantId } from '../services/authStorage.js';

const MAIN_TABS = [
  { value: 'orders', label: 'Order' },
  { value: 'menu', label: 'Menu' },
];

const MENU_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'veg', label: 'Veg' },
];

const EMPTY_ITEM_FORM = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  displayOrder: '',
  isAvailable: true,
  isVegetarian: false,
  isVegan: false,
};

const EMPTY_CATEGORY_FORM = {
  name: '',
  displayOrder: '',
  isActive: true,
};

function formatTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lower)) return true;
    if (['false', '0', 'no', 'off'].includes(lower)) return false;
  }
  return fallback;
}

function normalizeMenuItems(items = []) {
  return items.map((item, index) => ({
    ...item,
    id: item.id,
    name: item.name || item.title || `Item ${index + 1}`,
    description: item.description || '',
    price: normalizeNumber(item.price, 0),
    categoryId: item.category_id ?? item.categoryId ?? item.category?.id ?? '',
    categoryName: item.category_name ?? item.categoryName ?? item.category?.name ?? '',
    isAvailable: normalizeBoolean(item.is_available ?? item.isAvailable, true),
    isVegetarian: normalizeBoolean(item.is_vegetarian ?? item.isVegetarian, false),
    isVegan: normalizeBoolean(item.is_vegan ?? item.isVegan, false),
    displayOrder: normalizeNumber(item.display_order ?? item.displayOrder, index + 1),
  }));
}

function normalizeCategories(categories = []) {
  return categories
    .map((category, index) => ({
      ...category,
      id: category.id,
      name: category.name || `Category ${index + 1}`,
      displayOrder: normalizeNumber(category.display_order ?? category.displayOrder, index + 1),
      isActive: normalizeBoolean(category.is_active ?? category.isActive, true),
    }))
    .sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name));
}

function sortMenuItems(items = []) {
  return [...items].sort((a, b) => {
    const orderDelta = normalizeNumber(a.displayOrder) - normalizeNumber(b.displayOrder);
    if (orderDelta !== 0) return orderDelta;
    return a.name.localeCompare(b.name);
  });
}

function getMenuItemSearchText(item) {
  return [item.name, item.description, item.categoryName].filter(Boolean).join(' ').toLowerCase();
}

function matchesMenuFilter(item, filterValue) {
  if (filterValue === 'available') {
    return item.isAvailable;
  }

  if (filterValue === 'unavailable') {
    return !item.isAvailable;
  }

  if (filterValue === 'veg') {
    return item.isVegetarian || item.isVegan;
  }

  return true;
}

function filterMenuItems(items = [], searchQuery = '', filterValue = 'all') {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    const matchesSearch = !normalizedQuery || getMenuItemSearchText(item).includes(normalizedQuery);
    return matchesSearch && matchesMenuFilter(item, filterValue);
  });
}

function getCategoryItemCount(items = []) {
  return `${items.length} Item${items.length === 1 ? '' : 's'}`;
}

function groupMenuItems(items, categories) {
  const groups = [];
  const groupMap = new Map();

  categories.forEach((category) => {
    const key = `category:${category.id}`;
    const group = {
      key,
      title: category.name,
      category,
      items: [],
    };
    groups.push(group);
    groupMap.set(key, group);
  });

  const uncategorized = {
    key: 'uncategorized',
    title: 'Uncategorized',
    items: [],
  };

  items.forEach((item) => {
    const categoryId = item.categoryId || '';
    const categoryKey = categoryId ? `category:${categoryId}` : '';
    const categoryNameKey = item.categoryName ? `name:${item.categoryName.toLowerCase()}` : '';
    const matchedGroup = (categoryKey && groupMap.get(categoryKey)) || groupMap.get(categoryNameKey);
    if (matchedGroup) {
      matchedGroup.items.push(item);
      return;
    }

    if (item.categoryName && !groupMap.has(categoryNameKey)) {
      const customGroup = {
        key: categoryNameKey,
        title: item.categoryName,
        items: [item],
      };
      groups.push(customGroup);
      groupMap.set(categoryNameKey, customGroup);
      return;
    }

    uncategorized.items.push(item);
  });

  const sortedGroups = groups
    .map((group) => ({ ...group, items: sortMenuItems(group.items) }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => {
      const aOrder = a.category ? normalizeNumber(a.category.displayOrder) : Number.MAX_SAFE_INTEGER;
      const bOrder = b.category ? normalizeNumber(b.category.displayOrder) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.title.localeCompare(b.title);
    });

  const output = [...sortedGroups];
  if (uncategorized.items.length) {
    output.push({ ...uncategorized, items: sortMenuItems(uncategorized.items) });
  }
  return output;
}

function toItemForm(item) {
  if (!item) {
    return { ...EMPTY_ITEM_FORM };
  }

  return {
    name: item.name || '',
    description: item.description || '',
    price: item.price != null ? String(item.price) : '',
    categoryId: item.categoryId || '',
    displayOrder: item.displayOrder != null ? String(item.displayOrder) : '',
    isAvailable: normalizeBoolean(item.isAvailable, true),
    isVegetarian: normalizeBoolean(item.isVegetarian, false),
    isVegan: normalizeBoolean(item.isVegan, false),
  };
}

function toCategoryForm(category) {
  if (!category) {
    return { ...EMPTY_CATEGORY_FORM };
  }

  return {
    name: category.name || '',
    displayOrder: category.displayOrder != null ? String(category.displayOrder) : '',
    isActive: normalizeBoolean(category.isActive, true),
  };
}

function buildMenuItemPayload(form) {
  const categoryId = form.categoryId === '' ? null : normalizeNumber(form.categoryId, form.categoryId);
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    price: normalizeNumber(form.price, 0),
    categoryId,
    displayOrder: form.displayOrder === '' ? 0 : normalizeNumber(form.displayOrder, 0),
    isVegetarian: normalizeBoolean(form.isVegetarian, false),
    isVegan: normalizeBoolean(form.isVegan, false),
    isAvailable: normalizeBoolean(form.isAvailable, true),
  };
}

function buildCategoryPayload(form) {
  return {
    name: form.name.trim(),
    display_order: form.displayOrder === '' ? 0 : normalizeNumber(form.displayOrder, 0),
    is_active: normalizeBoolean(form.isActive, true),
  };
}

function parseDelimitedLine(line, delimiter = ',') {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvText(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) {
    return [];
  }

  const headers = parseDelimitedLine(rows[0]).map((header) => header.toLowerCase());
  return rows.slice(1).map((line) => {
    const values = parseDelimitedLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
}

function buildCsvImportPayload(rows, categories) {
  const categoryLookup = new Map(
    categories.map((category) => [category.name.trim().toLowerCase(), category]),
  );
  const groupedCategories = new Map();
  const uncategorizedItems = [];

  rows.forEach((row) => {
    const name = (row.name || row.item || row.item_name || '').trim();
    if (!name) {
      return;
    }

    const categoryName = (row.category || row.category_name || row.categoryname || '').trim();
    const item = {
      name,
      description: (row.description || '').trim(),
      price: normalizeNumber(row.price, 0),
      is_available: normalizeBoolean(row.is_available ?? row.available ?? row.status, true),
      is_vegetarian: normalizeBoolean(row.is_vegetarian ?? row.vegetarian, false),
      is_vegan: normalizeBoolean(row.is_vegan ?? row.vegan, false),
      display_order: normalizeNumber(row.display_order ?? row.displayorder, 0),
    };

    if (!categoryName) {
      uncategorizedItems.push(item);
      return;
    }

    const normalizedCategory = categoryLookup.get(categoryName.toLowerCase()) || null;
    const key = normalizedCategory ? `category:${normalizedCategory.id}` : `name:${categoryName.toLowerCase()}`;
    if (!groupedCategories.has(key)) {
      groupedCategories.set(key, {
        ...(normalizedCategory
          ? { id: normalizedCategory.id, name: normalizedCategory.name, display_order: normalizedCategory.displayOrder, is_active: normalizedCategory.isActive }
          : { name: categoryName, display_order: groupedCategories.size + 1, is_active: true }),
        items: [],
      });
    }

    groupedCategories.get(key).items.push(item);
  });

  return {
    categories: Array.from(groupedCategories.values()),
    uncategorized_items: uncategorizedItems,
  };
}

function MenuItemEditor({ title, itemForm, categories, onChange, onSave, onCancel, saving, editing }) {
  return (
    <section className="card kitchen-menu-panel">
      <div className="kitchen-menu-panel__header">
        <div>
          <p className="eyebrow">{editing ? 'Edit Item' : 'Add Item'}</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="kitchen-panel__toggle" onClick={onCancel}>
          Close
        </button>
      </div>

      <div className="kitchen-menu-form">
        <label className="kitchen-menu-field">
          <span>Name</span>
          <input
            value={itemForm.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="Chicken Biryani"
          />
        </label>

        <label className="kitchen-menu-field">
          <span>Price</span>
          <input
            type="number"
            step="0.01"
            value={itemForm.price}
            onChange={(event) => onChange('price', event.target.value)}
            placeholder="6.99"
          />
        </label>

        <label className="kitchen-menu-field kitchen-menu-field--wide">
          <span>Description</span>
          <textarea
            rows="3"
            value={itemForm.description}
            onChange={(event) => onChange('description', event.target.value)}
            placeholder="Short description"
          />
        </label>

        <label className="kitchen-menu-field">
          <span>Category</span>
          <select value={itemForm.categoryId} onChange={(event) => onChange('categoryId', event.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="kitchen-menu-field">
          <span>Display order</span>
          <input
            type="number"
            value={itemForm.displayOrder}
            onChange={(event) => onChange('displayOrder', event.target.value)}
            placeholder="1"
          />
        </label>
      </div>

      <div className="kitchen-menu-checks">
        <label>
          <input
            type="checkbox"
            checked={itemForm.isAvailable}
            onChange={(event) => onChange('isAvailable', event.target.checked)}
          />
          Available
        </label>
        <label>
          <input
            type="checkbox"
            checked={itemForm.isVegetarian}
            onChange={(event) => onChange('isVegetarian', event.target.checked)}
          />
          Vegetarian
        </label>
        <label>
          <input
            type="checkbox"
            checked={itemForm.isVegan}
            onChange={(event) => onChange('isVegan', event.target.checked)}
          />
          Vegan
        </label>
      </div>

      <div className="kitchen-menu-actions">
        <button type="button" className="primary-btn emphasis" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Update Item' : '+Add Item'}
        </button>
        <button type="button" className="primary-btn ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function CategoryEditor({
  categories,
  categoryForm,
  onChange,
  onSave,
  onEdit,
  onCancel,
  saving,
  editing,
  isOpen,
  onToggleOpen,
}) {
  return (
    <section className="card kitchen-menu-panel">
      <div className="kitchen-menu-panel__header">
        <div>
          <p className="eyebrow">Categories</p>
          <h2>Manage categories</h2>
        </div>
        <button type="button" className="kitchen-panel__toggle" onClick={onToggleOpen}>
          {isOpen ? 'Hide' : 'Create Category'}
        </button>
      </div>

      <div className="kitchen-menu-category-strip">
        <span className="kitchen-menu-category-strip__label">Categories:</span>
        {categories.length ? (
          categories.map((category) => (
            <span key={category.id} className="kitchen-menu-category-chip">
              {category.name}
            </span>
          ))
        ) : (
          <span className="muted">No categories yet</span>
        )}
      </div>

      {isOpen ? (
        <>
          <div className="kitchen-menu-form">
            <label className="kitchen-menu-field">
              <span>Name</span>
              <input
                value={categoryForm.name}
                onChange={(event) => onChange('name', event.target.value)}
                placeholder="Starters"
              />
            </label>

            <label className="kitchen-menu-field">
              <span>Display order</span>
              <input
                type="number"
                value={categoryForm.displayOrder}
                onChange={(event) => onChange('displayOrder', event.target.value)}
                placeholder="1"
              />
            </label>
          </div>

          <div className="kitchen-menu-checks">
            <label>
              <input
                type="checkbox"
                checked={categoryForm.isActive}
                onChange={(event) => onChange('isActive', event.target.checked)}
              />
              Active
            </label>
          </div>

          <div className="kitchen-menu-actions">
            <button type="button" className="primary-btn emphasis" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update Category' : 'Create Category'}
            </button>
            <button type="button" className="primary-btn ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className="muted kitchen-menu-category-collapsed">
          Category editing is collapsed by default. Open it only when you need to add or edit groups.
        </p>
      )}

      <div className="kitchen-menu-category-list">
        {categories.map((category) => (
          <article key={category.id} className="kitchen-menu-category-row">
            <div>
              <strong>{category.name}</strong>
              <p className="muted">
                Order {normalizeNumber(category.displayOrder, 0)} • {category.isActive ? 'Active' : 'Hidden'}
              </p>
            </div>
            <button type="button" className="primary-btn secondary" onClick={() => onEdit(category)}>
              Edit
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ImportPanel({ title, subtitle, children, onClose }) {
  return (
    <section className="card kitchen-menu-panel">
      <div className="kitchen-menu-panel__header">
        <div>
          <p className="eyebrow">Import</p>
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
        </div>
        <button type="button" className="kitchen-panel__toggle" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </section>
  );
}

function MenuItemRow({
  item,
  categoryLabel,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
  onSelectToggle,
  selected = false,
  selectMode = false,
  deleting,
  toggling,
  duplicating,
}) {
  return (
    <article className={`kitchen-menu-item${item.isAvailable ? '' : ' kitchen-menu-item--disabled'}`}>
      <div className="kitchen-menu-item__top">
        {selectMode ? (
          <label className="kitchen-menu-item__select">
            <input type="checkbox" checked={selected} onChange={onSelectToggle} />
            <span>Select</span>
          </label>
        ) : null}
        <div className="kitchen-menu-item__copy">
          <div className="kitchen-menu-item__title-row">
            <strong>{item.name}</strong>
            <span>{formatCurrency(item.price)}</span>
          </div>
          <p className="muted">
            {categoryLabel || 'Uncategorized'}
            {item.description ? ` • ${item.description}` : ''}
          </p>
        </div>
      </div>

      <div className="kitchen-menu-item__meta">
        <span className={`kitchen-menu-status${item.isAvailable ? ' active' : ''}`}>
          {item.isAvailable ? 'ON' : 'OFF'}
        </span>
        {item.isVegetarian ? <span className="kitchen-menu-status">Vegetarian</span> : null}
        {item.isVegan ? <span className="kitchen-menu-status">Vegan</span> : null}
      </div>

      <div className="kitchen-menu-item__actions">
        <button type="button" className="primary-btn secondary" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="primary-btn ghost" onClick={onDuplicate} disabled={duplicating}>
          {duplicating ? 'Duplicating…' : 'Duplicate'}
        </button>
        <button type="button" className="primary-btn ghost" onClick={onToggle} disabled={toggling}>
          {toggling ? 'Updating…' : item.isAvailable ? 'Disable' : 'Enable'}
        </button>
        <button type="button" className="primary-btn danger" onClick={onDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </article>
  );
}

export default function KitchenMenuPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activePanel, setActivePanel] = useState('list');
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuFilter, setMenuFilter] = useState('all');
  const [savingItem, setSavingItem] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantId, setRestaurantId] = useState(() => getKitchenRestaurantId() || '');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM_FORM });
  const [editingItemId, setEditingItemId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ ...EMPTY_CATEGORY_FORM });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [bulkJson, setBulkJson] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImportPayload, setCsvImportPayload] = useState(null);
  const feedbackTimerRef = useRef(null);
  const itemEditorRef = useRef(null);
  const categoryEditorRef = useRef(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [menuResponse, categoryResponse] = await Promise.all([
        fetchKitchenMenuItems(),
        fetchKitchenMenuCategories(),
      ]);
      const nextCategories = normalizeCategories(categoryResponse || []);
      setMenuItems(normalizeMenuItems(menuResponse.items || []));
      setCategories(nextCategories);
      setRestaurant(menuResponse.restaurant || null);
      setRestaurantId((current) => current || getKitchenRestaurantId() || menuResponse.restaurant?.id || '');
      setLastUpdated(new Date());
      setBulkCategoryId((current) => current || (nextCategories[0]?.id ? String(nextCategories[0].id) : ''));
      setSelectedItemIds([]);
      setBulkSelectMode(false);
      setCategoryEditorOpen(false);
    } catch (err) {
      setMenuItems([]);
      setCategories([]);
      setError(err.message || 'Unable to load menu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (!feedback) return undefined;

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 3500);

    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [feedback]);

  useEffect(() => {
    if (activePanel === 'item') {
      itemEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activePanel]);

  useEffect(() => {
    if (categoryEditorOpen) {
      categoryEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [categoryEditorOpen]);

  const categoryOptions = useMemo(() => normalizeCategories(categories), [categories]);
  const filteredMenuItems = useMemo(
    () => filterMenuItems(menuItems, searchQuery, menuFilter),
    [menuItems, searchQuery, menuFilter],
  );
  const groupedItems = useMemo(
    () => groupMenuItems(filteredMenuItems, categoryOptions),
    [filteredMenuItems, categoryOptions],
  );
  const categoryLine = useMemo(
    () => (categoryOptions.length ? categoryOptions.map((category) => category.name).join(' | ') : 'No categories yet'),
    [categoryOptions],
  );
  const selectedItems = useMemo(
    () => menuItems.filter((item) => selectedItemIds.includes(item.id)),
    [menuItems, selectedItemIds],
  );
  const bulkCategoryOptions = useMemo(() => categoryOptions, [categoryOptions]);

  const handleMainTabChange = (tab) => {
    if (tab === 'orders') {
      navigate('/kitchen/orders');
      return;
    }

    navigate('/kitchen/menu');
  };

  const showFeedback = (kind, message) => {
    setFeedback({ kind, message });
  };

  const resetItemForm = () => {
    setItemForm({ ...EMPTY_ITEM_FORM });
    setEditingItemId(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ ...EMPTY_CATEGORY_FORM });
    setEditingCategoryId(null);
  };

  const closePanels = () => {
    setActivePanel('list');
    setCategoryEditorOpen(false);
    resetItemForm();
    resetCategoryForm();
  };

  const handleToggleCategoryEditor = () => {
    setCategoryEditorOpen((current) => {
      const next = !current;
      if (!next) {
        resetCategoryForm();
      }
      return next;
    });
  };

  const handleItemFieldChange = (field, value) => {
    setItemForm((current) => ({ ...current, [field]: value }));
  };

  const handleCategoryFieldChange = (field, value) => {
    setCategoryForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddItem = (categoryId = '') => {
    resetItemForm();
    setItemForm((current) => ({ ...current, categoryId }));
    setActivePanel('item');
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm(toItemForm(item));
    setActivePanel('item');
  };

  const handleDuplicateItem = async (item) => {
    const defaultName = item.name ? `${item.name} Copy` : 'Copy of menu item';
    const nextName = window.prompt('Duplicate item as', defaultName)?.trim();
    if (!nextName) {
      return;
    }

    setDuplicatingId(item.id);
    try {
      await createKitchenMenuItem(restaurantId, {
        ...buildMenuItemPayload(toItemForm(item)),
        name: nextName,
      });
      showFeedback('success', 'Menu item duplicated.');
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to duplicate menu item');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) {
      showFeedback('error', 'Item name is required.');
      return;
    }
    if (!restaurantId) {
      showFeedback('error', 'Restaurant context is not available yet.');
      return;
    }

    setSavingItem(true);
    try {
      const payload = buildMenuItemPayload(itemForm);
      if (editingItemId) {
        await updateKitchenMenuItem(editingItemId, payload);
        showFeedback('success', 'Menu item updated.');
      } else {
        await createKitchenMenuItem(restaurantId, payload);
        showFeedback('success', 'Menu item created.');
      }
      closePanels();
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to save menu item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = window.confirm('Are you sure you want to delete this item?');
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await deleteKitchenMenuItem(item.id);
      showFeedback('success', 'Menu item deleted.');
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to delete menu item');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleItem = async (item) => {
    setTogglingId(item.id);
    try {
      await toggleKitchenMenuItemAvailability(item.id, { is_available: !item.isAvailable });
      showFeedback('success', `${item.name} availability updated.`);
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to update availability');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCategoryEdit = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm(toCategoryForm(category));
    setCategoryEditorOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      showFeedback('error', 'Category name is required.');
      return;
    }
    if (!restaurantId) {
      showFeedback('error', 'Restaurant context is not available yet.');
      return;
    }

    setSavingCategory(true);
    try {
      const payload = buildCategoryPayload(categoryForm);
      if (editingCategoryId) {
        await updateKitchenMenuCategory(restaurantId, editingCategoryId, payload);
        showFeedback('success', 'Category updated.');
      } else {
        await createKitchenMenuCategory(restaurantId, payload);
        showFeedback('success', 'Category created.');
      }
      closePanels();
      setCategoryEditorOpen(false);
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to save category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleLoadCurrentExport = async () => {
    if (!restaurantId) {
      showFeedback('error', 'Restaurant context is not available yet.');
      return;
    }

    setBulkBusy(true);
    try {
      const payload = await fetchKitchenMenuExport(restaurantId);
      setBulkJson(JSON.stringify(payload, null, 2));
      setActivePanel('bulk');
      showFeedback('info', 'Current export loaded into the bulk import editor.');
    } catch (err) {
      showFeedback('error', err.message || 'Unable to load export');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleOpenCsvPanel = () => {
    setActivePanel('csv');
  };

  const handleBulkImport = async () => {
    if (!bulkJson.trim()) {
      showFeedback('error', 'Paste export JSON before importing.');
      return;
    }
    if (!restaurantId) {
      showFeedback('error', 'Restaurant context is not available yet.');
      return;
    }

    setBulkBusy(true);
    try {
      const payload = JSON.parse(bulkJson);
      await importKitchenMenu(restaurantId, payload);
      showFeedback('success', 'Bulk import completed.');
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to import menu');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleCsvFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setCsvBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsvText(text);
      const payload = buildCsvImportPayload(rows, categoryOptions);
      setCsvImportPayload(payload);
      setCsvFileName(file.name);
      handleOpenCsvPanel();
      showFeedback('info', `Parsed ${rows.length} CSV row(s) from ${file.name}.`);
    } catch (err) {
      showFeedback('error', err.message || 'Unable to parse CSV');
    } finally {
      setCsvBusy(false);
      event.target.value = '';
    }
  };

  const handleToggleSelectMode = () => {
    setBulkSelectMode((current) => {
      const next = !current;
      if (!next) {
        setSelectedItemIds([]);
      }
      return next;
    });
  };

  const handleSelectItem = (itemId) => {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  };

  const handleSelectAllVisible = () => {
    setSelectedItemIds(groupedItems.flatMap((group) => group.items.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedItemIds([]);
  };

  const updateSelectedItems = async (updater, successMessage) => {
    if (!selectedItems.length) {
      showFeedback('error', 'Select at least one item first.');
      return;
    }

    try {
      await Promise.all(selectedItems.map(updater));
      showFeedback('success', successMessage);
      clearSelection();
      setBulkSelectMode(false);
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to complete bulk action');
    }
  };

  const handleBulkDisable = () =>
    updateSelectedItems(
      (item) => toggleKitchenMenuItemAvailability(item.id, { is_available: false }),
      'Selected items disabled.',
    );

  const handleBulkDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this item?');
    if (!confirmed) {
      return;
    }

    await updateSelectedItems((item) => deleteKitchenMenuItem(item.id), 'Selected items deleted.');
  };

  const handleBulkChangeCategory = async () => {
    if (!bulkCategoryId) {
      showFeedback('error', 'Choose a category first.');
      return;
    }

    await updateSelectedItems(
      (item) =>
        updateKitchenMenuItem(item.id, {
          ...buildMenuItemPayload(toItemForm(item)),
          categoryId: normalizeNumber(bulkCategoryId, bulkCategoryId),
        }),
      'Selected items moved to the new category.',
    );
  };

  const handleCsvImport = async () => {
    if (!csvImportPayload) {
      showFeedback('error', 'Choose a CSV file first.');
      return;
    }
    if (!restaurantId) {
      showFeedback('error', 'Restaurant context is not available yet.');
      return;
    }

    setCsvBusy(true);
    try {
      await importKitchenMenu(restaurantId, csvImportPayload);
      showFeedback('success', 'CSV import completed.');
      await loadMenu();
    } catch (err) {
      showFeedback('error', err.message || 'Unable to import CSV');
    } finally {
      setCsvBusy(false);
    }
  };

  const activeTab = 'menu';

  let content = null;
  if (loading) {
    content = <div className="kitchen-empty-state">Loading menu…</div>;
  } else if (error) {
    content = <div className="kitchen-empty-state">{error}</div>;
  } else {
    content = (
      <div className="kitchen-menu-board">
        <section className="card kitchen-menu-toolbar">
          <div className="kitchen-menu-toolbar__actions">
            <button type="button" className="primary-btn emphasis" onClick={() => handleAddItem()}>
              +Add Item
            </button>
            <button type="button" className="primary-btn secondary" onClick={handleLoadCurrentExport}>
              {bulkBusy ? 'Loading…' : 'Bulk Upload'}
            </button>
            <label className="primary-btn ghost kitchen-menu-file-trigger">
              {csvBusy ? 'Processing…' : 'Import CSV'}
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} />
            </label>
          </div>
          <p className="kitchen-menu-toolbar__note muted">
            Use the buttons above to create items, import a current snapshot, or load a CSV file.
            Upload CSV with columns: name, price, category.
          </p>
        </section>

        <section className="card kitchen-menu-toolbar kitchen-menu-toolbar--compact">
          <div className="kitchen-menu-search-row">
            <label className="kitchen-menu-search">
              <span className="muted">Search menu Items</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search menu Items"
              />
            </label>

            <div className="kitchen-menu-filter-row">
              {MENU_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`kitchen-filter-chip${menuFilter === filter.value ? ' active' : ''}`}
                  onClick={() => setMenuFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="kitchen-menu-bulk-toggle">
            <button
              type="button"
              className={`primary-btn secondary${bulkSelectMode ? ' active' : ''}`}
              onClick={handleToggleSelectMode}
            >
              {bulkSelectMode ? 'Selecting…' : 'Select Items'}
            </button>
            <span className="muted">{selectedItemIds.length} selected</span>
            {selectedItemIds.length ? (
              <button type="button" className="kitchen-inline-link" onClick={clearSelection}>
                Clear selection
              </button>
            ) : null}
          </div>

          {bulkSelectMode && selectedItemIds.length ? (
            <div className="kitchen-menu-bulk-actions">
              <button type="button" className="primary-btn secondary" onClick={handleBulkDisable}>
                Disable
              </button>
              <button type="button" className="primary-btn ghost" onClick={handleBulkDelete}>
                Delete
              </button>
              <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
                <option value="">Change Category</option>
                {bulkCategoryOptions.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button type="button" className="primary-btn emphasis" onClick={handleBulkChangeCategory}>
                Change Category
              </button>
            </div>
          ) : null}
        </section>

        {activePanel === 'item' ? (
          <div ref={itemEditorRef}>
            <MenuItemEditor
              title={editingItemId ? 'Edit menu item' : 'Create a new menu item'}
              itemForm={itemForm}
              categories={categoryOptions}
              onChange={handleItemFieldChange}
              onSave={handleSaveItem}
              onCancel={closePanels}
              saving={savingItem}
              editing={Boolean(editingItemId)}
            />
          </div>
        ) : null}

        {activePanel === 'bulk' ? (
          <ImportPanel
            title="Bulk Upload"
            subtitle="Load the current export or paste a menu snapshot and import it back."
            onClose={closePanels}
          >
            <textarea
              rows="14"
              value={bulkJson}
              onChange={(event) => setBulkJson(event.target.value)}
              placeholder="Paste export JSON here"
            />
            <div className="kitchen-menu-actions">
              <button type="button" className="primary-btn secondary" onClick={handleLoadCurrentExport} disabled={bulkBusy}>
                {bulkBusy ? 'Loading…' : 'Load Current Export'}
              </button>
              <button type="button" className="primary-btn emphasis" onClick={handleBulkImport} disabled={bulkBusy}>
                {bulkBusy ? 'Importing…' : 'Import Snapshot'}
              </button>
            </div>
          </ImportPanel>
        ) : null}

        {activePanel === 'csv' ? (
          <ImportPanel
            title="Import CSV"
            subtitle="Upload CSV with columns: name, price, category"
            onClose={closePanels}
          >
            <div className="kitchen-menu-csv-summary">
              <strong>{csvFileName || 'No CSV file selected'}</strong>
              <p className="muted">Upload CSV with columns: name, price, category</p>
              <p className="muted">
                {csvImportPayload
                  ? `${csvImportPayload.categories.length} categories and ${csvImportPayload.uncategorized_items.length} uncategorized item(s) ready to import.`
                  : 'Choose a CSV file to prepare an import payload.'}
              </p>
            </div>
            <div className="kitchen-menu-actions">
              <button type="button" className="primary-btn secondary" onClick={handleLoadCurrentExport} disabled={csvBusy}>
                {csvBusy ? 'Loading…' : 'Load Snapshot'}
              </button>
              <button type="button" className="primary-btn emphasis" onClick={handleCsvImport} disabled={csvBusy || !csvImportPayload}>
                {csvBusy ? 'Importing…' : 'Import CSV'}
              </button>
            </div>
          </ImportPanel>
        ) : null}

        <section className="card kitchen-menu-section">
          <div className="kitchen-menu-section__header">
            <div>
              <p className="eyebrow">Menu</p>
              <h2>{restaurant?.name || 'Kitchen Menu'}</h2>
              <p className="muted">{categoryLine}</p>
            </div>
            <div className="kitchen-menu-section__meta">
              <span>Items: {menuItems.length}</span>
              <span>Last updated: {formatTimestamp(lastUpdated)}</span>
            </div>
          </div>

          <div className="kitchen-menu-groups">
            {groupedItems.length ? (
              groupedItems.map((group) => (
                <section key={group.key} className="kitchen-menu-group">
                  <div className="kitchen-menu-group__header">
                    <div className="kitchen-menu-group__title">
                      <h3>{group.title}</h3>
                      <span className="muted">({getCategoryItemCount(group.items)})</span>
                    </div>
                    <button
                      type="button"
                      className="primary-btn secondary kitchen-menu-group__add"
                      onClick={() => handleAddItem(group.category?.id ? String(group.category.id) : '')}
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="kitchen-menu-list">
                    {group.items.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        categoryLabel={group.title}
                        onEdit={() => handleEditItem(item)}
                        onDuplicate={() => handleDuplicateItem(item)}
                        onDelete={() => handleDeleteItem(item)}
                        onToggle={() => handleToggleItem(item)}
                        onSelectToggle={() => handleSelectItem(item.id)}
                        selected={selectedItemIds.includes(item.id)}
                        selectMode={bulkSelectMode}
                        deleting={deletingId === item.id}
                        toggling={togglingId === item.id}
                        duplicating={duplicatingId === item.id}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="kitchen-empty-state">No menu items yet. Use +Add Item to start building the menu.</div>
            )}
          </div>
        </section>

        <div ref={categoryEditorRef}>
          <CategoryEditor
            categories={categoryOptions}
            categoryForm={categoryForm}
            onChange={handleCategoryFieldChange}
            onSave={handleSaveCategory}
            onEdit={handleCategoryEdit}
            onCancel={closePanels}
            onToggleOpen={handleToggleCategoryEditor}
            isOpen={categoryEditorOpen}
            saving={savingCategory}
            editing={Boolean(editingCategoryId)}
          />
        </div>
      </div>
    );
  }

  return (
    <main className="page-section kitchen-page kitchen-dashboard kitchen-menu-page">
      <header className="card kitchen-dashboard__topbar">
        <div className="kitchen-dashboard__brand">
          <p className="kitchen-dashboard__eyebrow">GO2PIK KITCHEN</p>
          <h1>Kitchen Dashboard</h1>
        </div>
        <div className="kitchen-dashboard__updated">
          <span>Last updated: {formatTimestamp(lastUpdated)}</span>
        </div>
        <div className="kitchen-dashboard__actions">
          <button type="button" className="kitchen-icon-btn" onClick={loadMenu} aria-label="Refresh menu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.6V4h2v8h-8V10l2.7 2.7A6 6 0 1 0 18 17h2a8 8 0 1 1-16-5Z" />
            </svg>
          </button>
          <button type="button" className="kitchen-icon-btn" onClick={() => navigate('/kitchen/orders')} aria-label="Back to orders">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 5 6 12l7 7 1.4-1.4L9.8 13H18v-2H9.8l4.6-4.6Z" />
            </svg>
          </button>
        </div>
      </header>

      {feedback && <div className={`kitchen-feedback kitchen-feedback--${feedback.kind}`}>{feedback.message}</div>}

      <section className="card kitchen-toolbar kitchen-main-tabs">
        <KitchenTabs tabs={MAIN_TABS} activeTab={activeTab} onTabChange={handleMainTabChange} />
      </section>

      {content}
    </main>
  );
}
