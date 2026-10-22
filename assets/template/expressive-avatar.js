const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

class Spring {
  constructor(value, config = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = config.stiffness ?? 0.1;
    this.damping = config.damping ?? 0.5;
  }
  step(deltaMs, reduced = false) {
    if (reduced) {
      this.value = this.target;
      this.velocity = 0;
      return;
    }
    const frames = Math.min(4, Math.max(1, Math.ceil(deltaMs / 16.667)));
    const step = deltaMs / frames / 16.667;
    for (let index = 0; index < frames; index += 1) {
      this.velocity += (this.target - this.value) * this.stiffness * step;
      this.velocity *= Math.pow(this.damping, step);
      this.value += this.velocity * step;
    }
  }
}

class ExpressiveAvatar extends HTMLElement {
  static observedAttributes = ["manifest"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.abort = null;
    this.manifestData = null;
    this.currentDirection = "look-away";
    this.triggeredUntilLeave = new Set();
    this.wonderTimer = 0;
    this.forcedPose = null;
    this.glassesHeld = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  connectedCallback() { this.load(); }
  disconnectedCallback() { this.destroy(); }
  attributeChangedCallback() { if (this.isConnected) this.load(); }

  destroy() {
    this.abort?.abort();
    this.abort = null;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.wonderTimer);
  }

  async load() {
    this.destroy();
    const manifestUrl = new URL(this.getAttribute("manifest") || "./avatar.manifest.json", document.baseURI);
    try {
      const manifest = await fetch(manifestUrl).then((response) => {
        if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
        return response.json();
      });
      const resolve = (relative) => new URL(relative, manifestUrl).href;
      this.manifestData = manifest;
      this.assetUrl = resolve;
      await this.renderComponent();
      this.bindInteractions();
      this.startLoop();
      this.maybePlayIntro();
    } catch (error) {
      this.shadowRoot.innerHTML = `<p part="error">Avatar failed: ${String(error.message || error)}</p>`;
    }
  }

  async renderComponent() {
    const manifest = this.manifestData;
    const { width, height } = manifest.canvas;
    const poseEntries = Object.entries(manifest.poses);
    const marks = (manifest.wonder?.marks ?? []).map((mark, index) => `
      <g style="--i:${index}"><path d="${mark.path}"></path><path class="dot" d="M${mark.dot[0]} ${mark.dot[1]}h0"></path></g>`).join("");
    const glasses = manifest.glasses;
    this.shadowRoot.innerHTML = `
      <style>${this.componentCss()}</style>
      <span class="stage" role="img" aria-label="Interactive illustrated avatar">
        ${poseEntries.map(([name, source]) => `<img class="pose" data-pose="${name}" src="${this.assetUrl(source)}" alt="" draggable="false">`).join("")}
        <span class="glasses" style="transform-origin:${glasses.origin[0] / width * 100}% ${glasses.origin[1] / height * 100}%">
          <svg viewBox="0 0 ${width} ${height}" stroke-width="${glasses.strokeWidth}">
            <circle cx="${glasses.left.cx}" cy="${glasses.left.cy}" r="${glasses.left.r}"></circle>
            <circle cx="${glasses.right.cx}" cy="${glasses.right.cy}" r="${glasses.right.r}"></circle>
            <path d="${glasses.bridgePath}"></path>
          </svg>
        </span>
        <svg class="marks" viewBox="0 0 ${width} ${height}">${marks}</svg>
        <svg class="intro" viewBox="0 0 ${width} ${height}"></svg>
      </span>`;
    this.stage = this.shadowRoot.querySelector(".stage");
    this.glassesElement = this.shadowRoot.querySelector(".glasses");
    this.introElement = this.shadowRoot.querySelector(".intro");
    this.poseElements = new Map([...this.shadowRoot.querySelectorAll(".pose")].map((image) => [image.dataset.pose, image]));
  }

  componentCss() {
    return `
      :host{display:inline-block;width:8rem;aspect-ratio:1;color:inherit;--avatar-paper:#fff}
      *{box-sizing:border-box}.stage{position:relative;display:block;width:100%;height:100%;cursor:grab;user-select:none;touch-action:none}
      .stage.held{cursor:grabbing}.pose,.glasses,.glasses svg,.marks,.intro{position:absolute;inset:0;width:100%;height:100%;display:block}
      .pose{object-fit:contain;opacity:0;transition:opacity .16s cubic-bezier(.22,1,.36,1)}.pose[data-pose=rest]{opacity:1}
      .glasses{will-change:transform}.glasses svg{fill:none;stroke:currentColor;stroke-linecap:round;overflow:visible}
      .marks{fill:none;stroke:currentColor;stroke-width:1.15;stroke-linecap:round;overflow:visible;pointer-events:none}
      .marks g{opacity:0;transform-box:fill-box;transform-origin:bottom;transform:translateY(3px) scale(.8);transition:opacity .16s,transform .16s}
      .marks .dot{stroke-width:1.8}.stage.wondering .marks g{opacity:1;transform:scale(1.3);transition:opacity .12s cubic-bezier(.22,1,.36,1) calc(var(--i)*var(--wonder-stagger)),transform .32s cubic-bezier(.34,1.56,.64,1) calc(var(--i)*var(--wonder-stagger))}
      .intro{overflow:visible;pointer-events:none}.intro path{fill:none;stroke-linecap:round;stroke-linejoin:round}
      .intro .drawing-tool{fill:var(--avatar-paper);stroke:currentColor;stroke-width:1.2}.intro .brush-tip{fill:currentColor}
      @media(prefers-reduced-motion:reduce){*{transition:none!important}}`;
  }

  bindInteractions() {
    const controller = new AbortController();
    this.abort = controller;
    const options = { signal: controller.signal };
    window.addEventListener("pointermove", (event) => this.onLook(event), options);
    window.addEventListener("pointerout", (event) => { if (!event.relatedTarget) this.setDirection("look-away"); }, options);
    this.stage.addEventListener("pointerdown", (event) => this.onGlassesDown(event), options);
    this.stage.addEventListener("pointermove", (event) => this.onGlassesMove(event), options);
    this.stage.addEventListener("lostpointercapture", () => this.onGlassesRelease(), options);
    this.addEventListener("avatar-wonder", () => this.wonder(), options);
  }

  onLook(event) {
    if (this.glassesHeld) return;
    const look = this.manifestData.look ?? {};
    const rect = this.stage.getBoundingClientRect();
    const anchor = look.faceAnchor ?? [0.48, 0.37];
    const dx = (event.clientX - (rect.left + rect.width * anchor[0])) / rect.width;
    const dy = (event.clientY - (rect.top + rect.height * anchor[1])) / rect.width;
    const radius = look.deadRadius ?? 0.25;
    if (Math.hypot(dx, dy) < radius) return this.setDirection("look-away");
    const cone = Math.tan((look.coneDegrees ?? 75) * Math.PI / 180);
    const vertical = Math.abs(dx) <= Math.abs(dy) * cone;
    const direction = vertical ? (dy < 0 ? "look-up" : "look-down") : (dx < 0 ? "look-left" : "look-right");
    this.setDirection(direction);
  }

  setDirection(direction) {
    if (direction === this.currentDirection) return;
    if (direction === "look-away") this.triggeredUntilLeave.clear();
    this.currentDirection = direction;
    this.applyRules(direction);
  }

  applyRules(trigger) {
    for (const [index, rule] of (this.manifestData.rules ?? []).entries()) {
      if (rule.when !== trigger) continue;
      if (rule.onceUntilLeave && this.triggeredUntilLeave.has(index)) continue;
      if (rule.onceUntilLeave) this.triggeredUntilLeave.add(index);
      for (const action of rule.do) this.applyAction(action);
    }
  }

  applyAction(action) {
    if (action.startsWith("pose:")) this.setPose(action.slice(5));
    else if (action === "question-marks") this.showQuestionMarks();
  }

  setPose(name) {
    if (!this.poseElements.has(name)) return;
    for (const [pose, image] of this.poseElements) image.style.opacity = pose === name ? "1" : "0";
  }

  wonder() { this.applyRules("wonder"); }
  showQuestionMarks() {
    clearTimeout(this.wonderTimer);
    const config = this.manifestData.wonder ?? {};
    this.stage.style.setProperty("--wonder-stagger", `${config.staggerMs ?? 110}ms`);
    this.stage.classList.remove("wondering");
    requestAnimationFrame(() => this.stage.classList.add("wondering"));
    this.wonderTimer = setTimeout(() => {
      this.stage.classList.remove("wondering");
      if (this.currentDirection === "look-away") this.setPose("rest");
      else this.applyRules(this.currentDirection);
    }, config.durationMs ?? 1400);
  }

  onGlassesDown(event) {
    if (event.button !== 0) return;
    this.glassesHeld = true;
    this.pointerId = event.pointerId;
    this.pointerStart = [event.clientX, event.clientY];
    this.stage.setPointerCapture(event.pointerId);
    this.stage.classList.add("held");
    const lift = this.manifestData.glasses.lift ?? [0.38, -0.22];
    this.glassesX.target = lift[0];
    this.glassesY.target = lift[1];
    this.applyRules("glasses-lift");
  }

  onGlassesMove(event) {
    if (!this.glassesHeld || event.pointerId !== this.pointerId) return;
    const rect = this.stage.getBoundingClientRect();
    const lift = this.manifestData.glasses.lift ?? [0.38, -0.22];
    this.glassesX.target = lift[0] + (event.clientX - this.pointerStart[0]) / rect.width;
    this.glassesY.target = lift[1] + (event.clientY - this.pointerStart[1]) / rect.width;
  }

  onGlassesRelease() {
    this.glassesHeld = false;
    this.stage.classList.remove("held");
    this.glassesX.target = 0;
    this.glassesY.target = 0;
    this.applyRules("glasses-release");
  }

  startLoop() {
    const spring = this.manifestData.glasses.spring ?? {};
    this.glassesX = new Spring(0, spring);
    this.glassesY = new Spring(0, spring);
    let previous = performance.now();
    const tick = (now) => {
      const delta = Math.min(50, now - previous);
      previous = now;
      this.glassesX.step(delta, this.reduced);
      this.glassesY.step(delta, this.reduced);
      const lift = clamp(Math.hypot(this.glassesX.value, this.glassesY.value) / 0.42);
      const turn = -12 * Math.sign(this.glassesX.value || 1) * lift;
      const scale = 1 + lift * 0.18;
      this.glassesElement.style.transform = `translate(${this.glassesX.value * 100}%,${this.glassesY.value * 100}%) rotate(${turn}deg) scale(${scale})`;
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  async maybePlayIntro(force = false) {
    const config = this.manifestData.intro;
    if (this.reduced) return;
    const key = `expressive-avatar:intro:${this.getAttribute("manifest") || "default"}`;
    const previous = Number(localStorage.getItem(key) || 0);
    if (!force && Date.now() - previous < (config.replayHours ?? 24) * 3600000) return;
    localStorage.setItem(key, String(Date.now()));
    await this.playIntro();
  }

  async playIntro() {
    const config = this.manifestData.intro;
    const parser = new DOMParser();
    const [outlineText, paintText] = await Promise.all([
      fetch(this.assetUrl(config.outline)).then((response) => response.text()),
      fetch(this.assetUrl(config.paint)).then((response) => response.text()),
    ]);
    const outline = [...parser.parseFromString(outlineText, "image/svg+xml").querySelectorAll("path")];
    const paint = [...parser.parseFromString(paintText, "image/svg+xml").querySelectorAll("path")];
    const namespace = "http://www.w3.org/2000/svg";
    this.introElement.innerHTML = `
      <defs>
        <pattern id="avatar-paint" patternUnits="userSpaceOnUse" width="${this.manifestData.canvas.width}" height="${this.manifestData.canvas.height}">
          <image href="${this.assetUrl(this.manifestData.poses.rest)}" width="${this.manifestData.canvas.width}" height="${this.manifestData.canvas.height}"></image>
        </pattern>
        <filter id="avatar-bristles" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".3" numOctaves="2" seed="2"></feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="2" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
        </filter>
      </defs>
      <g class="drawing-tool"><g class="pen"><path d="M0 0-7-17C-8-20-7-24-5-26H5C7-24 8-20 7-17Z"></path><path d="M0-2V-13"></path></g><g class="brush" opacity="0"><path class="brush-tip" d="M0 0C-3-3-8-10-8-17H8C8-10 3-3 0 0Z"></path><path d="M-8-25H8V-17H-8ZM-7-25-5-60Q0-63 5-60L7-25Z"></path></g></g>`;
    const tool = this.introElement.querySelector(".drawing-tool");
    const pen = this.introElement.querySelector(".pen");
    const brush = this.introElement.querySelector(".brush");
    const all = [...outline.map((path) => [path, 2.5, "outline"]), ...paint.map((path) => [path, 16, "paint"])];
    const renderedPaths = [];
    for (const [source, width, kind] of all) {
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", source.getAttribute("d"));
      path.setAttribute("pathLength", "1");
      path.style.stroke = kind === "paint" ? "url(#avatar-paint)" : "currentColor";
      path.style.strokeWidth = String(width);
      path.style.strokeDasharray = "1 2";
      path.style.strokeDashoffset = "1";
      if (kind === "paint") path.setAttribute("filter", "url(#avatar-bristles)");
      this.introElement.append(path);
      renderedPaths.push({ path, kind });
    }
    for (const image of this.poseElements.values()) image.style.opacity = "0";
    let index = 0;
    let speed = 1;
    let fastFinish = false;
    const accelerate = () => { fastFinish = true; };
    const inputEvents = ["pointerdown", "keydown", "wheel", "touchmove"];
    inputEvents.forEach((event) => window.addEventListener(event, accelerate, { once: true, passive: true }));
    const drawNext = () => {
      if (index >= renderedPaths.length) {
        inputEvents.forEach((event) => window.removeEventListener(event, accelerate));
        tool.style.opacity = "0";
        this.introElement.style.opacity = "0";
        this.setPose("rest");
        setTimeout(() => { this.introElement.innerHTML = ""; this.introElement.style.opacity = "1"; }, 220);
        return;
      }
      const { path, kind } = renderedPaths[index++];
      pen.setAttribute("opacity", kind === "outline" ? "1" : "0");
      brush.setAttribute("opacity", kind === "paint" ? "1" : "0");
      const length = path.getTotalLength();
      const baseDuration = Math.max(120, length * (kind === "paint" ? 0.55 : 1.1));
      let start = performance.now();
      let prior = start;
      let progress = 0;
      const tick = (now) => {
        const delta = Math.min(50, now - prior);
        prior = now;
        if (fastFinish) {
          const left = renderedPaths.length - index + (1 - progress);
          speed = Math.max(speed, baseDuration * left / Math.max(1, config.fastFinishMs ?? 300));
        }
        progress = clamp(progress + delta * speed / baseDuration);
        path.style.strokeDashoffset = String(1 - progress);
        const point = path.getPointAtLength(length * progress);
        tool.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(45) scale(.55)`);
        if (progress < 1) requestAnimationFrame(tick);
        else drawNext();
      };
      requestAnimationFrame(tick);
    };
    drawNext();
  }

  replay() { this.maybePlayIntro(true); }
}

if (!customElements.get("expressive-avatar")) customElements.define("expressive-avatar", ExpressiveAvatar);
export { ExpressiveAvatar };
