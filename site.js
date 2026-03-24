const collapsibleSections = new Map();
const THEME_STORAGE_KEY = "preferred-theme";
let batchToggleButton = null;

if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
}

window.addEventListener("pageshow", () => {
    const navigationEntry = performance.getEntriesByType("navigation")[0];

    if (navigationEntry?.type === "reload" && !window.location.hash) {
        window.scrollTo(0, 0);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    syncCurrentYear();
    runSetup(setupReveal);
    runSetup(setupThemeToggle);
    runSetup(setupCollapsibleSections);
    runSetup(setupPaperJumpLinks);
    runSetup(setupBatchToggle);
    runSetup(setupHoverPreviews);
    runSetup(setupHeader);
    runSetup(setupProgressRail);
});

function runSetup(setup) {
    try {
        setup();
    } catch (error) {
        console.error(`Setup failed: ${setup.name}`, error);
    }
}

function syncCurrentYear() {
    document.querySelectorAll("[data-current-year]").forEach((node) => {
        node.textContent = String(new Date().getFullYear());
    });
}

function setupThemeToggle() {
    const tools = getHeaderToolsContainer();

    if (!tools) {
        return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "site-mode-toggle";
    button.setAttribute("aria-label", "Toggle color theme");
    tools.append(button);

    const storedTheme = readStoredTheme();
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme || (systemPrefersDark ? "dark" : "light");

    applyTheme(initialTheme, button);

    button.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme, button);
        storeTheme(nextTheme);
    });
}

function getHeaderToolsContainer() {
    const headerInner = document.querySelector(".site-header__inner");

    if (!headerInner) {
        return null;
    }

    let tools = headerInner.querySelector(".site-header__tools");

    if (!tools) {
        tools = document.createElement("div");
        tools.className = "site-header__tools";
        headerInner.append(tools);
    }

    return tools;
}

function setupHeader() {
    const header = document.querySelector(".site-header");

    if (!header) {
        return;
    }

    const sync = () => {
        header.classList.toggle("is-scrolled", window.scrollY > 16);
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
}

function setupProgressRail() {
    const sections = getSections();
    const fill = document.getElementById("progress-fill");
    const dots = [...document.querySelectorAll("[data-scroll-target]")];

    if (!sections.length || !fill || !dots.length) {
        return;
    }

    const updateRail = () => {
        const currentScroll = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? currentScroll / maxScroll : 0;
        fill.style.transform = `scaleY(${Math.min(Math.max(progress, 0), 1)})`;
        const isAtPageEnd = maxScroll <= 0 || currentScroll >= maxScroll - 2;

        const focusLine = currentScroll + window.innerHeight * 0.32;
        let activeId = sections[0].id;

        sections.forEach((section) => {
            if (section.offsetTop <= focusLine) {
                activeId = section.id;
            }
        });

        if (isAtPageEnd) {
            activeId = sections[sections.length - 1].id;
        }

        dots.forEach((dot) => {
            dot.classList.toggle("is-active", dot.getAttribute("data-scroll-target") === activeId);
        });
    };

    let ticking = false;

    const requestUpdate = () => {
        if (ticking) {
            return;
        }

        ticking = true;
        window.requestAnimationFrame(() => {
            updateRail();
            ticking = false;
        });
    };

    dots.forEach((dot) => {
        dot.addEventListener("click", () => {
            const targetId = dot.getAttribute("data-scroll-target");

            if (!targetId) {
                return;
            }

            navigateToSection(targetId);
        });
    });

    updateRail();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
}

function getSections() {
    return [...document.querySelectorAll("[data-section-anchor]")];
}

function setupCollapsibleSections() {
    const sections = [...document.querySelectorAll("[data-collapsible-section]")];

    if (!sections.length) {
        return;
    }

    sections.forEach((section) => {
        const button = section.querySelector("[data-collapse-toggle]");
        const panel = section.querySelector("[data-collapsible-panel]");
        const label = button?.querySelector("[data-collapse-label]");

        if (!button || !panel || !section.id) {
            return;
        }

        const record = { button, label, panel, section };
        collapsibleSections.set(section.id, record);
        setExpandedState(record, true, true);

        button.addEventListener("click", () => {
            toggleSection(section.id);
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const targetId = link.getAttribute("href")?.slice(1);

            if (!targetId) {
                return;
            }

            const target = document.getElementById(targetId);

            if (!target || !target.matches("[data-section-anchor]")) {
                return;
            }

            event.preventDefault();
            navigateToSection(targetId);
        });
    });
}

function setupBatchToggle() {
    if (!collapsibleSections.size) {
        return;
    }

    const tools = getHeaderToolsContainer();

    if (!tools) {
        return;
    }

    batchToggleButton = document.createElement("button");
    batchToggleButton.type = "button";
    batchToggleButton.className = "site-batch-toggle";
    tools.prepend(batchToggleButton);
    updateBatchToggle();

    batchToggleButton.addEventListener("click", async () => {
        if (areAllSectionsExpanded()) {
            await Promise.all([...collapsibleSections.values()].map((record) => collapseSection(record)));
        } else {
            await Promise.all([...collapsibleSections.keys()].map((sectionId) => expandSection(sectionId)));
        }

        syncLayout();
    });
}

function toggleSection(sectionId) {
    const record = collapsibleSections.get(sectionId);

    if (!record || record.panel.dataset.animating === "true") {
        return;
    }

    const isExpanded = record.button.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
        collapseSection(record);
        return;
    }

    expandSection(sectionId);
}

function expandSection(sectionId) {
    const record = collapsibleSections.get(sectionId);

    if (!record || record.panel.dataset.animating === "true") {
        return Promise.resolve();
    }

    if (record.button.getAttribute("aria-expanded") === "true" && !record.panel.hidden) {
        return Promise.resolve();
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    record.panel.hidden = false;
    setExpandedState(record, true);

    if (prefersReducedMotion) {
        record.panel.style.height = "";
        syncLayout();
        return Promise.resolve();
    }

    record.panel.dataset.animating = "true";
    record.panel.style.height = "0px";
    record.panel.getBoundingClientRect();

    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            record.panel.style.height = `${record.panel.scrollHeight}px`;
        });

        const finish = (event) => {
            if (event.propertyName !== "height") {
                return;
            }

            record.panel.dataset.animating = "";
            record.panel.style.height = "";
            record.panel.removeEventListener("transitionend", finish);
            syncLayout();
            resolve();
        };

        record.panel.addEventListener("transitionend", finish);
    });
}

function collapseSection(record) {
    if (!record || record.panel.dataset.animating === "true") {
        return Promise.resolve();
    }

    if (record.button.getAttribute("aria-expanded") !== "true" || record.panel.hidden) {
        return Promise.resolve();
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
        setExpandedState(record, false);
        record.panel.hidden = true;
        record.panel.style.height = "";
        syncLayout();
        return Promise.resolve();
    }

    record.panel.dataset.animating = "true";
    record.panel.hidden = false;
    record.panel.style.height = `${record.panel.scrollHeight}px`;
    record.panel.getBoundingClientRect();
    setExpandedState(record, false);

    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            record.panel.style.height = "0px";
        });

        const finish = (event) => {
            if (event.propertyName !== "height") {
                return;
            }

            record.panel.hidden = true;
            record.panel.dataset.animating = "";
            record.panel.style.height = "";
            record.panel.removeEventListener("transitionend", finish);
            syncLayout();
            resolve();
        };

        record.panel.addEventListener("transitionend", finish);
    });
}

function setExpandedState(record, isExpanded, instant = false) {
    record.button.setAttribute("aria-expanded", String(isExpanded));

    if (record.label) {
        record.label.textContent = isExpanded ? "[-]" : "[+]";
    }

    record.section.classList.toggle("is-collapsed", !isExpanded);
    updateBatchToggle();

    if (instant) {
        record.panel.hidden = !isExpanded;
    }
}

function syncLayout() {
    window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
    });
}

async function navigateToSection(sectionId) {
    const target = document.getElementById(sectionId);

    if (!target) {
        return;
    }

    await expandSection(sectionId);
    const destination = Math.max(getDocumentTop(target) - getScrollPaddingTop(), 0);
    window.scrollTo({
        top: destination,
        behavior: "smooth"
    });
}

function setupPaperJumpLinks() {
    const links = [...document.querySelectorAll('a[href^="#paper-"]')];

    if (!links.length) {
        return;
    }

    links.forEach((link) => {
        link.addEventListener("click", async (event) => {
            const targetId = link.getAttribute("href")?.slice(1);

            if (!targetId) {
                return;
            }

            const target = document.getElementById(targetId);

            if (!target) {
                return;
            }

            event.preventDefault();
            await expandSection("publications");

            const destination = Math.max(getDocumentTop(target) - getScrollPaddingTop() - 24, 0);
            window.scrollTo({
                top: destination,
                behavior: "smooth"
            });

            flashPaperHighlight(target);
        });
    });
}

function areAllSectionsExpanded() {
    return [...collapsibleSections.values()].every(
        (record) => record.button.getAttribute("aria-expanded") === "true"
    );
}

function updateBatchToggle() {
    if (!batchToggleButton) {
        return;
    }

    const allExpanded = areAllSectionsExpanded();
    batchToggleButton.textContent = allExpanded ? "[all -]" : "[all +]";
    batchToggleButton.setAttribute(
        "aria-label",
        allExpanded ? "Collapse all sections" : "Expand all sections"
    );
}

function setupHoverPreviews() {
    const supportsHover = window.matchMedia("(hover: hover)").matches;
    const items = [...document.querySelectorAll("[data-hover-preview]")];

    if (!supportsHover || !items.length) {
        items.forEach((item) => item.classList.add("is-preview-visible"));
        return;
    }

    const cursor = document.createElement("div");
    cursor.className = "preview-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);

    items.forEach((item) => {
        let timerId = null;
        let frameId = null;
        let pendingPoint = null;

        const flushCursorPosition = () => {
            if (!pendingPoint) {
                frameId = null;
                return;
            }

            cursor.style.transform =
                `translate3d(${pendingPoint.x}, ${pendingPoint.y}, 0) translate(-50%, -50%) scale(1)`;
            pendingPoint = null;
            frameId = null;
        };

        const queueCursorPosition = (x, y) => {
            pendingPoint = { x, y };

            if (frameId !== null) {
                return;
            }

            frameId = window.requestAnimationFrame(flushCursorPosition);
        };

        const placeCursor = (event) => {
            if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
                return;
            }

            queueCursorPosition(`${event.clientX}px`, `${event.clientY}px`);
        };

        const clearPreview = () => {
            if (timerId) {
                window.clearTimeout(timerId);
                timerId = null;
            }

            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
            }

            pendingPoint = null;
            item.classList.remove("is-hover-pending", "is-preview-visible");
            cursor.classList.remove("is-visible", "is-loading");
        };

        const armPreview = (event) => {
            clearPreview();
            placeCursor(event);
            item.classList.add("is-hover-pending");
            cursor.classList.add("is-visible");

            // Restart the 1.5s progress animation on each new hover.
            cursor.classList.remove("is-loading");
            cursor.getBoundingClientRect();
            cursor.classList.add("is-loading");

            timerId = window.setTimeout(() => {
                item.classList.remove("is-hover-pending");
                item.classList.add("is-preview-visible");
                cursor.classList.remove("is-visible", "is-loading");
                timerId = null;
            }, 1500);
        };

        item.addEventListener("pointerenter", armPreview);
        item.addEventListener("pointermove", placeCursor);
        item.addEventListener("pointerleave", clearPreview);
        item.addEventListener("focusin", armPreview);
        item.addEventListener("focusout", clearPreview);
    });
}

let paperHighlightStartTimeoutId = null;
let paperHighlightTimeoutId = null;

function flashPaperHighlight(target) {
    if (!target) {
        return;
    }

    document.querySelectorAll(".row-item.is-paper-highlighted").forEach((item) => {
        item.classList.remove("is-paper-highlighted");
    });

    if (paperHighlightStartTimeoutId) {
        window.clearTimeout(paperHighlightStartTimeoutId);
    }

    if (paperHighlightTimeoutId) {
        window.clearTimeout(paperHighlightTimeoutId);
    }

    paperHighlightStartTimeoutId = window.setTimeout(() => {
        target.classList.add("is-paper-highlighted");
        paperHighlightStartTimeoutId = null;

        paperHighlightTimeoutId = window.setTimeout(() => {
            target.classList.remove("is-paper-highlighted");
            paperHighlightTimeoutId = null;
        }, 1600);
    }, 360);
}

function applyTheme(theme, button) {
    document.documentElement.dataset.theme = theme;

    if (button) {
        button.textContent = theme === "dark" ? "[light]" : "[dark]";
    }
}

function readStoredTheme() {
    try {
        return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
        return null;
    }
}

function storeTheme(theme) {
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Ignore storage failures and keep the theme in-memory only.
    }
}

function setupReveal() {
    const items = [...document.querySelectorAll("[data-reveal]")];

    if (!items.length) {
        return;
    }

    document.documentElement.classList.add("has-reveal");

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        items.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add("is-visible");
            instance.unobserve(entry.target);
        });
    }, {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px"
    });

    const initialFold = window.innerHeight * 0.92;

    items.forEach((item, index) => {
        item.style.setProperty("--reveal-delay", `${Math.min(index * 45, 180)}ms`);

        if (item.getBoundingClientRect().top <= initialFold) {
            item.classList.add("is-visible");
            return;
        }

        observer.observe(item);
    });
}

function getDocumentTop(element) {
    return element.getBoundingClientRect().top + window.scrollY;
}

function getScrollPaddingTop() {
    return parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}
