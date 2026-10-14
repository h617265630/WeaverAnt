import { useCallback, useEffect, useRef } from "react";

// Follow only the main conversation, never a sidebar or selection thread.
export function useReplyFollow(dock, enabled) {
  const following = useRef(true);
  const scheduleRef = useRef(() => {});
  const resume = useCallback(() => {
    following.current = true;
    scheduleRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const composer = dock.current;
    const main = composer?.closest(".hub-chat")?.querySelector(".zone-b-content");
    const flow = main?.querySelector(".zone-b-flow");
    if (!main || !flow) return;
    let frame = 0;
    let lastY = main.scrollTop;
    let userScrolling = false;
    const gap = () => main.scrollHeight - main.clientHeight - main.scrollTop;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!following.current) return;
        const delta = gap();
        if (Math.abs(delta) > 1) {
          main.scrollTo({ top: main.scrollHeight, behavior: "instant" });
          lastY = main.scrollTop;
        }
      });
    };
    scheduleRef.current = () => {
      userScrolling = false;
      lastY = main.scrollTop;
      schedule();
    };
    const onScroll = () => {
      const y = main.scrollTop;
      if (userScrolling && y < lastY - 2) following.current = false;
      else if (y > lastY + 2 && Math.abs(gap()) < 80) following.current = true;
      lastY = y;
    };
    const onWheel = (event) => {
      userScrolling = true;
      // Stop before the next streamed chunk can counteract an upward gesture.
      if (event.deltaY < 0)
        following.current = false;
    };
    const onPointer = () => { userScrolling = true; };
    const onKey = (event) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        userScrolling = true;
        if (["ArrowUp", "PageUp", "Home"].includes(event.key)) following.current = false;
      }
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(main);
    observer.observe(flow);
    observer.observe(composer);
    main.addEventListener("scroll", onScroll, { passive: true });
    main.addEventListener("wheel", onWheel, { passive: true });
    main.addEventListener("pointerdown", onPointer, { passive: true });
    main.addEventListener("touchstart", onPointer, { passive: true });
    main.addEventListener("keydown", onKey);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      scheduleRef.current = () => {};
      main.removeEventListener("scroll", onScroll);
      main.removeEventListener("wheel", onWheel);
      main.removeEventListener("pointerdown", onPointer);
      main.removeEventListener("touchstart", onPointer);
      main.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", schedule);
    };
  }, [dock, enabled]);
  return resume;
}
