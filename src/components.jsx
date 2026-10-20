import React, { useEffect, useRef, useState } from "react";
export function Icon({ name = "spark", ...props }) {
  const paths = {
    sidebar: "M3 4h18v16H3zM9 4v16",
    chevron: "m9 5 7 7-7 7",
    home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
    folder:
      "M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
    note: "M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    plus: "M12 5v14M5 12h14",
    search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
    layers: "m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5",
    code: "m8 5-7 7 7 7m8-14 7 7-7 7m-3-16-2 18",
    check: "m5 12 4 4L20 5",
    copy: "M9 9h12v12H9zM5 15H3V3h12v2",
    close: "m6 6 12 12M6 18 18 6",
    back: "M19 12H5m6-6-6 6 6 6",
    send: "M12 20V4m-6 6 6-6 6 6",
    stop: "M6 6h12v12H6z",
    select: "m4 3 4 17 4-7 7-4zM14 14l6 6",
    refresh: "M20 7v5h-5M4 17v-5h5M19 8a8 8 0 0 0-14-2M5 16a8 8 0 0 0 14 2",
    link: "m9 15 6-6M7 14l-2 2a3 3 0 0 0 4 4l4-4m4-6 2-2a3 3 0 0 0-4-4l-4 4",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    edit: "m4 16 12-12 4 4L8 20H4zm10-10 4 4",
    external: "M14 3h7v7m0-7L11 13M10 5H4v15h15v-6",
    file: "M5 3h9l5 5v13H5zm9 0v5h5",
    chat: "M3 4h18v13H9l-6 4z",
    history: "M3 11a9 9 0 1 1 2 7M3 3v8h8m1-4v5l3 2",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
export function Button({
  children,
  icon,
  primary,
  small,
  quiet,
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn ${primary ? "primary" : ""} ${small ? "small" : ""} ${quiet ? "quiet" : ""} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <Button
          icon="close"
          className="icon"
          quiet
          aria-label="关闭弹窗"
          onClick={onClose}
        />
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function FormModal({
  title,
  description,
  fields,
  submitLabel = "保存",
  onSubmit,
  onClose,
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
            onClose();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {description && <p className="modal-description">{description}</p>}
        {fields.map((field) => (
          <label key={field.name} className="field">
            <span>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                aria-label={field.label}
                name={field.name}
                defaultValue={field.value || ""}
                placeholder={field.placeholder}
                required={field.required}
              />
            ) : field.type === "select" ? (
              <select
                aria-label={field.label}
                name={field.name}
                defaultValue={field.value}
              >
                {field.options.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={field.label}
                name={field.name}
                defaultValue={field.value || ""}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}{" "}
            {field.hint && <small>{field.hint}</small>}
          </label>
        ))}
        {error && (
          <div className="modal-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            取消
          </Button>
          <Button primary disabled={busy} type="submit">
            {busy ? "正在保存…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Empty({ title, description, children }) {
  return (
    <div className="empty">
      <Icon name="layers" />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
