import React, { useEffect, useMemo, useRef, useState } from "react";

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const samples = {
  Song: {
    Short: "Great is Your faithfulness",
    "Two Lines": "Great is Your faithfulness\nGreat is Your faithfulness",
    "Four Lines":
      "Great is Your faithfulness\nGreat is Your faithfulness\nMorning by morning\nNew mercies I see",
    "Long Lyrics":
      "You give life, You are love\nYou bring light to the darkness\nYou give hope, You restore\nEvery heart that is broken",
  },
  Scripture: {
    Short: "Jesus wept.",
    "Long Verse":
      "In the beginning God created the heavens and the earth. Now the earth was formless and empty, darkness was over the surface of the deep.",
    "Multiple Verses":
      "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life. For God did not send his Son into the world to condemn the world, but to save the world through him.",
  },
  Presentation: { Welcome: "WELCOME TO\nSUPERNATURAL LIFE CHURCH" },
};
const labelFor = (element) =>
  element.name ||
  { primary: "Lyrics / Scripture", secondary: "Reference" }[element.binding] ||
  { shape: "Shape", image: "Image" }[element.type] ||
  "Text";

export default function ThemeDesignerAdvanced({
  value,
  media,
  onCancel,
  onSave,
  renderScene,
}) {
  const [draft, setDraft] = useState(() => clone(value)),
    [selection, setSelection] = useState(() =>
      value.elements?.[0] ? [value.elements[0].id] : [],
    ),
    [history, setHistory] = useState([]),
    [future, setFuture] = useState([]),
    [clipboard, setClipboard] = useState([]),
    [zoom, setZoom] = useState("fit"),
    [guides, setGuides] = useState([]),
    [view, setView] = useState({
      grid: false,
      centres: true,
      safe: true,
      snapGrid: false,
      snapGuides: true,
      snapObjects: true,
    }),
    [previewMode, setPreviewMode] = useState(
      value.contentType === "Scripture" ? "Scripture" : "Song",
    ),
    [sampleName, setSampleName] = useState(
      value.contentType === "Scripture" ? "Short" : "Two Lines",
    ),
    [customText, setCustomText] = useState(""),
    [previewOnly, setPreviewOnly] = useState(false),
    [surface, setSurface] = useState("grid"),
    [context, setContext] = useState(null),
    [marquee, setMarquee] = useState(null);
  const canvasRef = useRef(null),
    interaction = useRef(null),
    dragLayer = useRef(null),
    selected = draft.elements.filter((element) =>
      selection.includes(element.id),
    ),
    primary = selected.length === 1 ? selected[0] : null,
    canvasW = draft.canvasWidth || 1920,
    canvasH = draft.canvasHeight || 1080;
  const sampleText =
    customText ||
    samples[previewMode]?.[sampleName] ||
    Object.values(samples[previewMode] || {})[0] ||
    "Preview";
  const sample = {
    id: "theme-designer-preview",
    title: draft.name,
    type: previewMode,
    theme: draft,
    slides: [
      {
        name: "Preview",
        text: sampleText,
        reference: previewMode === "Scripture" ? "Genesis 1:1 (NKJV)" : "",
      },
    ],
  };
  const selectionBounds = useMemo(() => {
    if (selected.length < 2) return null;
    const left = Math.min(...selected.map((item) => item.x)),
      top = Math.min(...selected.map((item) => item.y)),
      right = Math.max(...selected.map((item) => item.x + item.width)),
      bottom = Math.max(...selected.map((item) => item.y + item.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, [draft.elements, selection]);
  const commit = (next) => {
    setHistory((items) => [...items.slice(-79), clone(draft)]);
    setFuture([]);
    setDraft(next);
  };
  const mutate = (updater, record = true) =>
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (record) {
        setHistory((items) => [...items.slice(-79), clone(current)]);
        setFuture([]);
      }
      return next;
    });
  const patchSelected = (change, record = true) =>
    mutate(
      (current) => ({
        ...current,
        elements: current.elements.map((element) =>
          selection.includes(element.id)
            ? {
                ...element,
                ...change,
                style: change.style
                  ? { ...element.style, ...change.style }
                  : element.style,
              }
            : element,
        ),
      }),
      record,
    );
  const undo = () =>
    setHistory((items) => {
      if (!items.length) return items;
      const previous = items.at(-1);
      setFuture((next) => [clone(draft), ...next]);
      setDraft(previous);
      return items.slice(0, -1);
    });
  const redo = () =>
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setHistory((previous) => [...previous, clone(draft)]);
      setDraft(next);
      return items.slice(1);
    });
  const add = (type = "dynamic", binding = "primary") => {
    const id = `element-${Date.now()}`,
      element = {
        id,
        name:
          type === "shape"
            ? "Background Panel"
            : binding === "secondary"
              ? "Reference"
              : previewMode === "Scripture"
                ? "Scripture"
                : "Lyrics",
        type,
        binding,
        x: 320,
        y: type === "shape" ? 720 : 300,
        width: type === "shape" ? 1280 : 1280,
        height: type === "shape" ? 240 : 320,
        rotation: 0,
        opacity: 1,
        zIndex: draft.elements.length + 1,
        visible: true,
        locked: false,
        style:
          type === "shape"
            ? { fill: "#173b33", border: "#000000", borderWidth: 0, radius: 0 }
            : {
                fontFamily: "Arial",
                fallbackFont: "sans-serif",
                fontSize: 72,
                minFontSize: 24,
                maxFontSize: 100,
                fontWeight: 700,
                color: "#ffffff",
                align: "center",
                verticalAlign: "middle",
                lineHeight: 1.2,
                letterSpacing: 0,
                autoFit: true,
                padding: 12,
                shadow: {
                  x: 0,
                  y: 4,
                  blur: 12,
                  color: "#000000",
                  opacity: 0.65,
                },
                outline: { width: 0, color: "#000000" },
              },
      };
    commit({ ...draft, elements: [...draft.elements, element] });
    setSelection([id]);
  };
  const remove = () => {
    if (!selection.length) return;
    commit({
      ...draft,
      elements: draft.elements.filter(
        (element) => !selection.includes(element.id),
      ),
    });
    setSelection([]);
  };
  const duplicate = () => {
    if (!selected.length) return;
    const stamp = Date.now(),
      copies = selected.map((element, index) => ({
        ...clone(element),
        id: `${element.id}-copy-${stamp}-${index}`,
        name: `${labelFor(element)} Copy`,
        x: element.x + 24,
        y: element.y + 24,
        zIndex: draft.elements.length + index + 1,
      }));
    commit({ ...draft, elements: [...draft.elements, ...copies] });
    setSelection(copies.map((item) => item.id));
  };
  const pasteItems = () => {
    if (!clipboard.length) return;
    const stamp = Date.now(),
      copies = clipboard.map((item, index) => ({
        ...clone(item),
        id: `paste-${stamp}-${index}`,
        x: clamp(item.x + 20, 0, canvasW - item.width),
        y: clamp(item.y + 20, 0, canvasH - item.height),
        zIndex: draft.elements.length + index + 1,
      }));
    commit({ ...draft, elements: [...draft.elements, ...copies] });
    setSelection(copies.map((item) => item.id));
    setContext(null);
  };
  const cut = () => {
    if (!selected.length) return;
    setClipboard(clone(selected));
    remove();
    setContext(null);
  };
  const reorderLayer = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    const ordered = [...draft.elements].sort(
        (a, b) => (b.zIndex || 0) - (a.zIndex || 0),
      ),
      source = ordered.find((item) => item.id === sourceId),
      rest = ordered.filter((item) => item.id !== sourceId),
      targetIndex = rest.findIndex((item) => item.id === targetId);
    if (!source || targetIndex < 0) return;
    rest.splice(targetIndex, 0, source);
    const zById = new Map(
      rest.map((item, index) => [item.id, rest.length - index]),
    );
    mutate((current) => ({
      ...current,
      elements: current.elements.map((item) => ({
        ...item,
        zIndex: zById.get(item.id),
      })),
    }));
  };
  const arrange = (mode) => {
    const max = Math.max(
        0,
        ...draft.elements.map((element) => element.zIndex || 0),
      ),
      min = Math.min(
        0,
        ...draft.elements.map((element) => element.zIndex || 0),
      );
    patchSelected(
      mode === "front"
        ? { zIndex: max + 1 }
        : mode === "back"
          ? { zIndex: min - 1 }
          : mode === "forward"
            ? { zIndex: (primary?.zIndex || 0) + 1 }
            : { zIndex: (primary?.zIndex || 0) - 1 },
    );
  };
  const align = (mode) => {
    if (!selected.length) return;
    const bounds =
      selected.length > 1
        ? {
            left: Math.min(...selected.map((e) => e.x)),
            right: Math.max(...selected.map((e) => e.x + e.width)),
            top: Math.min(...selected.map((e) => e.y)),
            bottom: Math.max(...selected.map((e) => e.y + e.height)),
          }
        : { left: 0, right: canvasW, top: 0, bottom: canvasH };
    mutate((current) => ({
      ...current,
      elements: current.elements.map((element) => {
        if (!selection.includes(element.id)) return element;
        if (mode === "left") return { ...element, x: bounds.left };
        if (mode === "hcenter")
          return {
            ...element,
            x: (bounds.left + bounds.right - element.width) / 2,
          };
        if (mode === "right")
          return { ...element, x: bounds.right - element.width };
        if (mode === "top") return { ...element, y: bounds.top };
        if (mode === "vcenter")
          return {
            ...element,
            y: (bounds.top + bounds.bottom - element.height) / 2,
          };
        return { ...element, y: bounds.bottom - element.height };
      }),
    }));
  };
  const distribute = (axis) => {
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) =>
        axis === "x" ? a.x - b.x : a.y - b.y,
      ),
      first = sorted[0],
      last = sorted.at(-1),
      span =
        axis === "x"
          ? last.x + last.width - first.x
          : last.y + last.height - first.y,
      total = sorted.reduce(
        (sum, item) => sum + (axis === "x" ? item.width : item.height),
        0,
      ),
      gap = (span - total) / (sorted.length - 1);
    let cursor = axis === "x" ? first.x : first.y;
    const positions = new Map(
      sorted.map((item) => {
        const position = cursor;
        cursor += (axis === "x" ? item.width : item.height) + gap;
        return [item.id, position];
      }),
    );
    mutate((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        positions.has(element.id)
          ? { ...element, [axis]: Math.round(positions.get(element.id)) }
          : element,
      ),
    }));
  };
  const snap = (value, targets, disabled) => {
    if (disabled) return { value, guide: null };
    let best = { distance: 7, value, guide: null };
    for (const target of targets) {
      const distance = Math.abs(value - target);
      if (distance < best.distance)
        best = { distance, value: target, guide: target };
    }
    return best;
  };
  const startInteraction = (event, element, handle = "move") => {
    if (element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const ids = event.shiftKey
      ? [...new Set([...selection, element.id])]
      : selection.includes(element.id)
        ? selection
        : [element.id];
    setSelection(ids);
    const rect = canvasRef.current.getBoundingClientRect(),
      start = { x: event.clientX, y: event.clientY },
      before = clone(draft),
      originals = new Map(
        draft.elements
          .filter((item) => ids.includes(item.id))
          .map((item) => [item.id, clone(item)]),
      );
    interaction.current = { before };
    const move = (pointer) => {
        const dx = ((pointer.clientX - start.x) * canvasW) / rect.width,
          dy = ((pointer.clientY - start.y) * canvasH) / rect.height;
        setDraft((current) => {
          const others = current.elements.filter(
              (item) => !ids.includes(item.id),
            ),
            guideX = view.snapGuides
              ? [0, canvasW / 2, canvasW, 96, canvasW - 96]
              : [],
            guideY = view.snapGuides
              ? [0, canvasH / 2, canvasH, 54, canvasH - 54]
              : [],
            objectX = view.snapObjects
              ? others.flatMap((item) => [
                  item.x,
                  item.x + item.width / 2,
                  item.x + item.width,
                ])
              : [],
            objectY = view.snapObjects
              ? others.flatMap((item) => [
                  item.y,
                  item.y + item.height / 2,
                  item.y + item.height,
                ])
              : [],
            xTargets = [...guideX, ...objectX],
            yTargets = [...guideY, ...objectY];
          let shown = [];
          const elements = current.elements.map((item) => {
            if (!ids.includes(item.id)) return item;
            const origin = originals.get(item.id);
            if (handle === "move") {
              let x = origin.x + dx,
                y = origin.y + dy;
              if (view.snapGrid && !pointer.altKey) {
                x = Math.round(x / 24) * 24;
                y = Math.round(y / 24) * 24;
              }
              const sx = snap(
                  x,
                  xTargets,
                  pointer.altKey || (!view.snapGuides && !view.snapObjects),
                ),
                sy = snap(
                  y,
                  yTargets,
                  pointer.altKey || (!view.snapGuides && !view.snapObjects),
                );
              x = sx.value;
              y = sy.value;
              if (sx.guide != null) shown.push({ axis: "x", value: sx.guide });
              if (sy.guide != null) shown.push({ axis: "y", value: sy.guide });
              return {
                ...item,
                x: Math.round(clamp(x, 0, canvasW - item.width)),
                y: Math.round(clamp(y, 0, canvasH - item.height)),
              };
            }
            let { x, y, width, height } = origin;
            if (handle.includes("e")) width = Math.max(20, origin.width + dx);
            if (handle.includes("s")) height = Math.max(20, origin.height + dy);
            if (handle.includes("w")) {
              x = origin.x + dx;
              width = Math.max(20, origin.width - dx);
            }
            if (handle.includes("n")) {
              y = origin.y + dy;
              height = Math.max(20, origin.height - dy);
            }
            if (view.snapGrid && !pointer.altKey) {
              if (handle.includes("e"))
                width = Math.max(20, Math.round((x + width) / 24) * 24 - x);
              if (handle.includes("s"))
                height = Math.max(20, Math.round((y + height) / 24) * 24 - y);
              if (handle.includes("w")) {
                const edge = Math.round(x / 24) * 24;
                width += x - edge;
                x = edge;
              }
              if (handle.includes("n")) {
                const edge = Math.round(y / 24) * 24;
                height += y - edge;
                y = edge;
              }
            }
            if (!pointer.altKey) {
              if (handle.includes("e")) {
                const hit = snap(x + width, xTargets, !xTargets.length);
                if (hit.guide != null) {
                  width = hit.value - x;
                  shown.push({ axis: "x", value: hit.guide });
                }
              }
              if (handle.includes("w")) {
                const hit = snap(x, xTargets, !xTargets.length);
                if (hit.guide != null) {
                  width += x - hit.value;
                  x = hit.value;
                  shown.push({ axis: "x", value: hit.guide });
                }
              }
              if (handle.includes("s")) {
                const hit = snap(y + height, yTargets, !yTargets.length);
                if (hit.guide != null) {
                  height = hit.value - y;
                  shown.push({ axis: "y", value: hit.guide });
                }
              }
              if (handle.includes("n")) {
                const hit = snap(y, yTargets, !yTargets.length);
                if (hit.guide != null) {
                  height += y - hit.value;
                  y = hit.value;
                  shown.push({ axis: "y", value: hit.guide });
                }
              }
            }
            return {
              ...item,
              x: Math.round(clamp(x, 0, canvasW - 20)),
              y: Math.round(clamp(y, 0, canvasH - 20)),
              width: Math.round(Math.min(width, canvasW - x)),
              height: Math.round(Math.min(height, canvasH - y)),
            };
          });
          setGuides(shown);
          return { ...current, elements };
        });
      },
      stop = () => {
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", stop);
        setGuides([]);
        setHistory((items) => [...items.slice(-79), before]);
        setFuture([]);
        interaction.current = null;
      };
    addEventListener("pointermove", move);
    addEventListener("pointerup", stop);
  };
  const startMarquee = (event) => {
    if (previewOnly || event.button !== 0 || event.target.closest(".element-box"))
      return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect(),
      point = (pointer) => ({
        x: clamp(((pointer.clientX - rect.left) * canvasW) / rect.width, 0, canvasW),
        y: clamp(((pointer.clientY - rect.top) * canvasH) / rect.height, 0, canvasH),
      }),
      start = point(event);
    setContext(null);
    setSelection(event.shiftKey ? selection : []);
    setMarquee({ x: start.x, y: start.y, width: 0, height: 0 });
    const move = (pointer) => {
        const current = point(pointer),
          box = {
            x: Math.min(start.x, current.x),
            y: Math.min(start.y, current.y),
            width: Math.abs(current.x - start.x),
            height: Math.abs(current.y - start.y),
          };
        setMarquee(box);
      },
      stop = (pointer) => {
        const current = point(pointer),
          box = {
            x: Math.min(start.x, current.x),
            y: Math.min(start.y, current.y),
            width: Math.abs(current.x - start.x),
            height: Math.abs(current.y - start.y),
          },
          hits = draft.elements
            .filter(
              (item) =>
                item.visible !== false &&
                item.x < box.x + box.width &&
                item.x + item.width > box.x &&
                item.y < box.y + box.height &&
                item.y + item.height > box.y,
            )
            .map((item) => item.id);
        setSelection(event.shiftKey ? [...new Set([...selection, ...hits])] : hits);
        setMarquee(null);
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", stop);
      };
    addEventListener("pointermove", move);
    addEventListener("pointerup", stop);
  };
  const zoomAtPointer = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const stage = event.currentTarget,
      oldScale = zoom === "fit" ? 1 : Number(zoom) / 100,
      next = clamp(Math.round((oldScale * 100 + (event.deltaY < 0 ? 10 : -10)) / 5) * 5, 25, 200),
      nextScale = next / 100,
      x = event.clientX - stage.getBoundingClientRect().left + stage.scrollLeft,
      y = event.clientY - stage.getBoundingClientRect().top + stage.scrollTop;
    setZoom(next);
    requestAnimationFrame(() => {
      stage.scrollLeft = x * (nextScale / oldScale) - (event.clientX - stage.getBoundingClientRect().left);
      stage.scrollTop = y * (nextScale / oldScale) - (event.clientY - stage.getBoundingClientRect().top);
    });
  };
  useEffect(() => {
    const keys = (event) => {
      if (event.target.matches("input,textarea,select,[contenteditable=true]"))
        return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        setContext(null);
        return;
      }
      if (event.ctrlKey && key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (event.ctrlKey && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.ctrlKey && key === "x") {
        event.preventDefault();
        cut();
        return;
      }
      if (event.ctrlKey && key === "c") {
        setClipboard(clone(selected));
        return;
      }
      if (event.ctrlKey && key === "v") {
        event.preventDefault();
        pasteItems();
        return;
      }
      if (event.ctrlKey && key === "d") {
        event.preventDefault();
        duplicate();
        return;
      }
      if (event.key === "Delete") {
        remove();
        return;
      }
      if (event.key.startsWith("Arrow") && selection.length) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1,
          dx =
            event.key === "ArrowLeft"
              ? -amount
              : event.key === "ArrowRight"
                ? amount
                : 0,
          dy =
            event.key === "ArrowUp"
              ? -amount
              : event.key === "ArrowDown"
                ? amount
                : 0;
        mutate((current) => ({
          ...current,
          elements: current.elements.map((element) =>
            selection.includes(element.id) && !element.locked
              ? {
                  ...element,
                  x: clamp(element.x + dx, 0, canvasW - element.width),
                  y: clamp(element.y + dy, 0, canvasH - element.height),
                }
              : element,
          ),
        }));
      }
    };
    const close = () => setContext(null);
    addEventListener("keydown", keys);
    addEventListener("pointerdown", close);
    return () => {
      removeEventListener("keydown", keys);
      removeEventListener("pointerdown", close);
    };
  });
  const effectiveScale = zoom === "fit" ? 1 : Number(zoom) / 100;
  return (
    <div className="advanced-theme-designer">
      <header>
        <strong>Theme Designer</strong>
        <input
          value={draft.name}
          onChange={(event) => mutate({ ...draft, name: event.target.value })}
        />
        <select
          title="Theme content type"
          value={draft.contentType || "All"}
          onChange={(event) => {
            const next = event.target.value;
            mutate({ ...draft, contentType: next });
            if (next !== "All") {
              setPreviewMode(next);
              setSampleName(Object.keys(samples[next] || {})[0]);
            }
          }}
        >
          <option>All</option>
          <option>Song</option>
          <option>Scripture</option>
          <option>Presentation</option>
        </select>
        <select
          title="Theme layout purpose"
          value={draft.layoutType || "Full Screen"}
          onChange={(event) =>
            mutate({ ...draft, layoutType: event.target.value })
          }
        >
          <option>Full Screen</option>
          <option>Lower Third</option>
        </select>
        <button onClick={undo} disabled={!history.length}>
          ↶ Undo
        </button>
        <button onClick={redo} disabled={!future.length}>
          ↷ Redo
        </button>
        <button onClick={() => setPreviewOnly((value) => !value)}>
          {previewOnly ? "Edit" : "Preview"}
        </button>
        <button
          className="primary"
          onClick={() =>
            onSave({ ...draft, canvasWidth: 1920, canvasHeight: 1080 })
          }
        >
          Save Changes
        </button>
        <button onClick={onCancel}>× Close</button>
      </header>
      <aside className="advanced-layers">
        <div className="add-tools">
          <button onClick={() => add("dynamic", "primary")}>＋ Text</button>
          <button onClick={() => add("dynamic", "secondary")}>
            ＋ Reference
          </button>
          <button onClick={() => add("shape", null)}>＋ Shape</button>
        </div>
        <strong>BACKGROUND</strong>
        <div className="background-settings">
          <select
            value={draft.background?.type || "solid"}
            onChange={(event) =>
              mutate({
                ...draft,
                background: { ...draft.background, type: event.target.value },
              })
            }
          >
            <option value="transparent">Transparent</option>
            <option value="solid">Solid Colour</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          {draft.background?.type === "solid" && (
            <input
              aria-label="Background colour"
              type="color"
              value={draft.background?.color || "#000000"}
              onChange={(event) =>
                mutate({
                  ...draft,
                  background: {
                    ...draft.background,
                    color: event.target.value,
                  },
                })
              }
            />
          )}{" "}
          {["image", "video"].includes(draft.background?.type) && (
            <>
              <select
                value={draft.background?.mediaId || ""}
                onChange={(event) => {
                  const item = media.find(
                    (mediaItem) => mediaItem.databaseId === event.target.value,
                  );
                  mutate({
                    ...draft,
                    background: {
                      ...draft.background,
                      mediaId: item?.databaseId || "",
                      url: item?.url || "",
                      fit: draft.background?.fit || "cover",
                      position: "center",
                    },
                  });
                }}
              >
                <option value="">Choose library media…</option>
                {media
                  .filter((item) =>
                    draft.background.type === "video"
                      ? item.mediaType === "Video"
                      : item.mediaType === "Image",
                  )
                  .map((item) => (
                    <option key={item.databaseId} value={item.databaseId}>
                      {item.title}
                    </option>
                  ))}
              </select>
              <select
                value={draft.background?.fit || "cover"}
                onChange={(event) =>
                  mutate({
                    ...draft,
                    background: {
                      ...draft.background,
                      fit: event.target.value,
                    },
                  })
                }
              >
                <option value="cover">Fill / Crop</option>
                <option value="fit">Fit</option>
                <option value="stretch">Stretch</option>
              </select>
            </>
          )}
        </div>
        <strong>LAYERS</strong>
        {[...draft.elements]
          .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
          .map((element) => (
            <div
              draggable
              className={selection.includes(element.id) ? "selected" : ""}
              key={element.id}
              onDragStart={() => {
                dragLayer.current = element.id;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                reorderLayer(dragLayer.current, element.id);
                dragLayer.current = null;
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (!selection.includes(element.id)) setSelection([element.id]);
                setContext({ x: event.clientX, y: event.clientY, elementId: element.id });
              }}
            >
              <button
                title="Visibility"
                onClick={() =>
                  mutate((current) => ({
                    ...current,
                    elements: current.elements.map((item) =>
                      item.id === element.id
                        ? { ...item, visible: item.visible === false }
                        : item,
                    ),
                  }))
                }
              >
                {element.visible === false ? "○" : "◉"}
              </button>
              <button
                title="Lock"
                onClick={() =>
                  mutate((current) => ({
                    ...current,
                    elements: current.elements.map((item) =>
                      item.id === element.id
                        ? { ...item, locked: !item.locked }
                        : item,
                    ),
                  }))
                }
              >
                {element.locked ? "🔒" : "◇"}
              </button>
              <button
                className="layer-name"
                onClick={(event) =>
                  setSelection(
                    event.shiftKey
                      ? [...new Set([...selection, element.id])]
                      : [element.id],
                  )
                }
              >
                {labelFor(element)}
              </button>
            </div>
          ))}
        <div className="layer-actions">
          <button onClick={duplicate}>Duplicate</button>
          <button onClick={remove}>Delete</button>
        </div>
      </aside>
      <main
        className={`advanced-stage surface-${surface} ${previewOnly ? "preview-only" : ""}`}
        onWheel={zoomAtPointer}
      >
        <div className="advanced-toolbar">
          <button onClick={() => align("left")}>⇤</button>
          <button onClick={() => align("hcenter")}>↔</button>
          <button onClick={() => align("right")}>⇥</button>
          <button onClick={() => align("top")}>⇡</button>
          <button onClick={() => align("vcenter")}>↕</button>
          <button onClick={() => align("bottom")}>⇣</button>
          <label>
            Sample
            <select
              value={sampleName}
              onChange={(event) => setSampleName(event.target.value)}
            >
              {Object.keys(samples[previewMode] || {}).map((name) => (
                <option key={name}>{name}</option>
              ))}
              <option>Custom</option>
            </select>
          </label>
          {sampleName === "Custom" && (
            <input
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
              placeholder="Custom preview text"
            />
          )}
          <label>
            Against
            <select
              value={surface}
              onChange={(event) => setSurface(event.target.value)}
            >
              <option value="grid">Grid</option>
              <option value="black">Black</option>
              <option value="white">White</option>
            </select>
          </label>
        </div>
        <div
          className="advanced-canvas-wrap"
          style={{ transform: `scale(${effectiveScale})` }}
        >
          <div
            className="advanced-canvas"
            ref={canvasRef}
            onPointerDown={startMarquee}
            onContextMenu={(event) => {
              event.preventDefault();
              setContext({ x: event.clientX, y: event.clientY, canvas: true });
            }}
          >
            {renderScene(sample)}
            {view.grid && <div className="editor-grid" />}
            {view.safe && <div className="safe-guide" />}
            {view.centres && (
              <>
                <i className="centre-guide x" />
                <i className="centre-guide y" />
              </>
            )}
            {guides.map((guide, index) => (
              <i
                key={index}
                className={`smart-guide ${guide.axis}`}
                style={
                  guide.axis === "x"
                    ? { left: `${(guide.value / canvasW) * 100}%` }
                    : { top: `${(guide.value / canvasH) * 100}%` }
                }
              />
            ))}
            {marquee && (
              <i
                className="selection-marquee"
                style={{
                  left: `${(marquee.x / canvasW) * 100}%`,
                  top: `${(marquee.y / canvasH) * 100}%`,
                  width: `${(marquee.width / canvasW) * 100}%`,
                  height: `${(marquee.height / canvasH) * 100}%`,
                }}
              />
            )}
            {selectionBounds && !previewOnly && (
              <i
                className="collective-selection"
                style={{
                  left: `${(selectionBounds.x / canvasW) * 100}%`,
                  top: `${(selectionBounds.y / canvasH) * 100}%`,
                  width: `${(selectionBounds.width / canvasW) * 100}%`,
                  height: `${(selectionBounds.height / canvasH) * 100}%`,
                }}
              />
            )}
            {!previewOnly &&
              draft.elements.map((element) => (
                <div
                  key={element.id}
                  className={`element-box ${selection.includes(element.id) ? "selected" : ""} ${element.locked ? "locked" : ""}`}
                  style={{
                    left: `${(element.x / canvasW) * 100}%`,
                    top: `${(element.y / canvasH) * 100}%`,
                    width: `${(element.width / canvasW) * 100}%`,
                    height: `${(element.height / canvasH) * 100}%`,
                    transform: `rotate(${element.rotation || 0}deg)`,
                  }}
                  onPointerDown={(event) => startInteraction(event, element)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!selection.includes(element.id)) setSelection([element.id]);
                    setContext({ x: event.clientX, y: event.clientY, elementId: element.id });
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelection(
                      event.shiftKey
                        ? [...new Set([...selection, element.id])]
                        : [element.id],
                    );
                  }}
                >
                  {selection.includes(element.id) &&
                    handles.map((handle) => (
                      <b
                        key={handle}
                        className={`resize-handle ${handle}`}
                        onPointerDown={(event) =>
                          startInteraction(event, element, handle)
                        }
                      />
                    ))}
                </div>
              ))}
          </div>
        </div>
        <div className="zoom-bar">
          <button
            onClick={() =>
              setZoom(Math.max(25, (zoom === "fit" ? 50 : Number(zoom)) - 25))
            }
          >
            −
          </button>
          <select
            value={zoom}
            onChange={(event) => setZoom(event.target.value)}
          >
            <option value="fit">Fit</option>
            {[25, 50, 75, 100].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              setZoom(Math.min(100, (zoom === "fit" ? 50 : Number(zoom)) + 25))
            }
          >
            ＋
          </button>
          <button onClick={() => setZoom(100)}>100%</button>
        </div>
      </main>
      {context && (
        <div
          className="theme-context-menu"
          style={{ left: context.x, top: context.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {context.canvas ? (
            <>
              <button disabled={!clipboard.length} onClick={pasteItems}>Paste</button>
              <button onClick={() => setView((current) => ({ ...current, grid: !current.grid }))}>{view.grid ? "Hide" : "Show"} Grid</button>
              <button onClick={() => setView((current) => ({ ...current, centres: !current.centres }))}>{view.centres ? "Hide" : "Show"} Centre Guides</button>
              <button onClick={() => setView((current) => ({ ...current, safe: !current.safe }))}>{view.safe ? "Hide" : "Show"} Safe Area</button>
              <button onClick={() => { setSurface("grid"); setContext(null); }}>Background Preview</button>
            </>
          ) : (
            <>
              <button onClick={cut}>Cut</button>
              <button onClick={() => { setClipboard(clone(selected)); setContext(null); }}>Copy</button>
              <button disabled={!clipboard.length} onClick={pasteItems}>Paste</button>
              <button onClick={() => { duplicate(); setContext(null); }}>Duplicate</button>
              <hr />
              <button onClick={() => { arrange("front"); setContext(null); }}>Bring to Front</button>
              <button onClick={() => { arrange("forward"); setContext(null); }}>Bring Forward</button>
              <button onClick={() => { arrange("backward"); setContext(null); }}>Send Backward</button>
              <button onClick={() => { arrange("back"); setContext(null); }}>Send to Back</button>
              <hr />
              <button onClick={() => { patchSelected({ locked: !selected.every((item) => item.locked) }); setContext(null); }}>{selected.every((item) => item.locked) ? "Unlock" : "Lock"}</button>
              <button onClick={() => { patchSelected({ visible: false }); setContext(null); }}>Hide</button>
              <button onClick={() => { const name = prompt("Layer name", primary ? labelFor(primary) : "Selected layers"); if (name) patchSelected({ name }); setContext(null); }}>Rename</button>
              <button className="danger" onClick={() => { remove(); setContext(null); }}>Delete</button>
            </>
          )}
        </div>
      )}
      <aside className="advanced-inspector">
        {primary ? (
          <>
            <header>
              <input
                value={labelFor(primary)}
                onChange={(event) =>
                  patchSelected({ name: event.target.value })
                }
              />
            </header>
            <fieldset>
              <legend>TRANSFORM</legend>
              {["x", "y", "width", "height", "rotation"].map((key) => (
                <label key={key}>
                  {key.toUpperCase()}
                  <input
                    type="number"
                    value={Math.round(primary[key] || 0)}
                    onChange={(event) =>
                      patchSelected({ [key]: Number(event.target.value) })
                    }
                  />
                </label>
              ))}
            </fieldset>
            {primary.type === "shape" ? (
              <fieldset>
                <legend>APPEARANCE</legend>
                <label>
                  Fill
                  <input
                    type="color"
                    value={primary.style?.fill || "#000000"}
                    onChange={(event) =>
                      patchSelected({ style: { fill: event.target.value } })
                    }
                  />
                </label>
                <label>
                  Opacity
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={primary.opacity ?? 1}
                    onChange={(event) =>
                      patchSelected({ opacity: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Border
                  <input
                    type="color"
                    value={primary.style?.border || "#000000"}
                    onChange={(event) =>
                      patchSelected({ style: { border: event.target.value } })
                    }
                  />
                </label>
                <label>
                  Border width
                  <input
                    type="number"
                    value={primary.style?.borderWidth || 0}
                    onChange={(event) =>
                      patchSelected({
                        style: { borderWidth: Number(event.target.value) },
                      })
                    }
                  />
                </label>
                <label>
                  Corner radius
                  <input
                    type="number"
                    value={primary.style?.radius || 0}
                    onChange={(event) =>
                      patchSelected({
                        style: { radius: Number(event.target.value) },
                      })
                    }
                  />
                </label>
                <label>
                  Shadow blur
                  <input
                    type="number"
                    value={primary.style?.shadow?.blur || 0}
                    onChange={(event) =>
                      patchSelected({
                        style: {
                          shadow: {
                            ...primary.style?.shadow,
                            blur: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
              </fieldset>
            ) : (
              <>
                <fieldset>
                  <legend>LAYOUT & TYPOGRAPHY</legend>
                  <label>
                    Font
                    <input
                      value={primary.style?.fontFamily || "Arial"}
                      onChange={(event) =>
                        patchSelected({
                          style: { fontFamily: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Weight
                    <select
                      value={primary.style?.fontWeight || 400}
                      onChange={(event) =>
                        patchSelected({
                          style: { fontWeight: Number(event.target.value) },
                        })
                      }
                    >
                      {[400, 600, 700, 800].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Size
                    <input
                      type="number"
                      value={primary.style?.fontSize || 72}
                      onChange={(event) =>
                        patchSelected({
                          style: { fontSize: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    Padding
                    <input
                      type="number"
                      min="0"
                      value={primary.style?.padding || 0}
                      onChange={(event) =>
                        patchSelected({
                          style: { padding: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    Minimum size
                    <input
                      type="number"
                      value={primary.style?.minFontSize || 24}
                      onChange={(event) =>
                        patchSelected({
                          style: { minFontSize: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    Maximum size
                    <input
                      type="number"
                      value={primary.style?.maxFontSize || 100}
                      onChange={(event) =>
                        patchSelected({
                          style: { maxFontSize: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    Colour
                    <input
                      type="color"
                      value={primary.style?.color || "#ffffff"}
                      onChange={(event) =>
                        patchSelected({ style: { color: event.target.value } })
                      }
                    />
                  </label>
                  <label>
                    Text align
                    <select
                      value={primary.style?.align || "center"}
                      onChange={(event) =>
                        patchSelected({ style: { align: event.target.value } })
                      }
                    >
                      <option>left</option>
                      <option>center</option>
                      <option>right</option>
                    </select>
                  </label>
                  <label>
                    Vertical align
                    <select
                      value={primary.style?.verticalAlign || "middle"}
                      onChange={(event) =>
                        patchSelected({
                          style: { verticalAlign: event.target.value },
                        })
                      }
                    >
                      <option>top</option>
                      <option>middle</option>
                      <option>bottom</option>
                    </select>
                  </label>
                  <label>
                    Line height
                    <input
                      type="number"
                      min=".5"
                      max="4"
                      step=".05"
                      value={primary.style?.lineHeight || 1.2}
                      onChange={(event) =>
                        patchSelected({
                          style: { lineHeight: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    Letter spacing
                    <input
                      type="number"
                      step=".5"
                      value={primary.style?.letterSpacing || 0}
                      onChange={(event) =>
                        patchSelected({
                          style: { letterSpacing: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    Case
                    <select
                      value={primary.style?.textTransform || "none"}
                      onChange={(event) =>
                        patchSelected({
                          style: { textTransform: event.target.value },
                        })
                      }
                    >
                      <option value="none">As entered</option>
                      <option value="uppercase">UPPERCASE</option>
                      <option value="lowercase">lowercase</option>
                      <option value="capitalize">Title Case</option>
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={Boolean(primary.style?.italic)}
                      onChange={(event) =>
                        patchSelected({
                          style: { italic: event.target.checked },
                        })
                      }
                    />{" "}
                    Italic
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={Boolean(primary.style?.underline)}
                      onChange={(event) =>
                        patchSelected({
                          style: { underline: event.target.checked },
                        })
                      }
                    />{" "}
                    Underline
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={primary.style?.autoFit !== false}
                      onChange={(event) =>
                        patchSelected({
                          style: { autoFit: event.target.checked },
                        })
                      }
                    />{" "}
                    Auto Fit
                  </label>
                </fieldset>
                <fieldset>
                  <legend>EFFECTS</legend>
                  <label>
                    Opacity
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={primary.opacity ?? 1}
                      onChange={(event) =>
                        patchSelected({ opacity: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Shadow X
                    <input
                      type="number"
                      value={primary.style?.shadow?.x || 0}
                      onChange={(event) =>
                        patchSelected({
                          style: {
                            shadow: {
                              ...primary.style?.shadow,
                              x: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Shadow Y
                    <input
                      type="number"
                      value={primary.style?.shadow?.y || 0}
                      onChange={(event) =>
                        patchSelected({
                          style: {
                            shadow: {
                              ...primary.style?.shadow,
                              y: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Shadow blur
                    <input
                      type="number"
                      value={primary.style?.shadow?.blur || 0}
                      onChange={(event) =>
                        patchSelected({
                          style: {
                            shadow: {
                              ...primary.style?.shadow,
                              blur: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Shadow colour
                    <input
                      type="color"
                      value={primary.style?.shadow?.color || "#000000"}
                      onChange={(event) =>
                        patchSelected({
                          style: {
                            shadow: {
                              ...primary.style?.shadow,
                              color: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Outline width
                    <input
                      type="number"
                      value={primary.style?.outline?.width || 0}
                      onChange={(event) =>
                        patchSelected({
                          style: {
                            outline: {
                              ...primary.style?.outline,
                              width: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Outline colour
                    <input
                      type="color"
                      value={primary.style?.outline?.color || "#000000"}
                      onChange={(event) =>
                        patchSelected({
                          style: {
                            outline: {
                              ...primary.style?.outline,
                              color: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                </fieldset>
              </>
            )}
            <fieldset>
              <legend>ARRANGE</legend>
              <button onClick={() => arrange("front")}>Bring to Front</button>
              <button onClick={() => arrange("forward")}>Bring Forward</button>
              <button onClick={() => arrange("backward")}>Send Backward</button>
              <button onClick={() => arrange("back")}>Send to Back</button>
            </fieldset>
          </>
        ) : selection.length > 1 ? (
          <>
            <div className="multi-selection-summary">
              {selection.length} layers selected
            </div>
            <fieldset>
              <legend>ALIGN SELECTION</legend>
              <button onClick={() => align("left")}>Align Left</button>
              <button onClick={() => align("hcenter")}>Align Centre</button>
              <button onClick={() => align("right")}>Align Right</button>
              <button onClick={() => align("top")}>Align Top</button>
              <button onClick={() => align("vcenter")}>Align Middle</button>
              <button onClick={() => align("bottom")}>Align Bottom</button>
              <button
                disabled={selection.length < 3}
                onClick={() => distribute("x")}
              >
                Distribute Horizontally
              </button>
              <button
                disabled={selection.length < 3}
                onClick={() => distribute("y")}
              >
                Distribute Vertically
              </button>
            </fieldset>
          </>
        ) : (
          <div className="empty-inspector">
            Select an element to edit its exact geometry and styling.
          </div>
        )}
        <fieldset>
          <legend>VIEW</legend>
          {Object.entries(view).map(([key, value]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={value}
                onChange={(event) =>
                  setView((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {key.replace(/([A-Z])/g, " $1")}
            </label>
          ))}
        </fieldset>
      </aside>
    </div>
  );
}
