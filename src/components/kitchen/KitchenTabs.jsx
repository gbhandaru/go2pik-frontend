export default function KitchenTabs({ tabs = [], activeTab, onTabChange }) {
  if (!tabs?.length) {
    return null;
  }

  return (
    <div className="kitchen-tabs">
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        const showCount = typeof tab.count === 'number';
        const isAlerting = tab.value === 'new' && showCount && tab.count > 0;
        return (
          <button
            key={tab.value}
            type="button"
            className={`kitchen-tab${isActive ? ' active' : ''}${isAlerting ? ' kitchen-tab--alert' : ''}`}
            onClick={() => onTabChange?.(tab.value)}
          >
            <span className="kitchen-tab__label">{tab.label}</span>
            {showCount ? (
              <span className={`kitchen-tab__count${isAlerting ? ' kitchen-tab__count--alert' : ''}`}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
