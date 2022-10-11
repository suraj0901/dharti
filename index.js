class Store {
  #state;
  constructor(obj) {
    this.#state = obj;
    Global.updateList.set(this, []);
  }
  get val() {
    if (!Global.isMounted) Global.emit(this);
    return this.#state;
  }
  set val(newVal) {
    this.#state = newVal;
    Global.runEffect(this);
  }
}

class Global {
  static listener = [];
  static onMount = {
    list: [],
    add(callbacks) {
      this.list.push(callbacks);
    },
    flush() {
      const list = [...this.list];
      this.list = [];
      return list;
    },
  };
  static updateList = new Map();
  static isMounted = false;
  static runEffect(changed) {
    const list = this.updateList.get(changed);
    for (const value of list) value();
  }
  static emit(emitted) {
    this.listener.push(emitted);
  }
  static addEffect(callback, dependencies) {
    if (!dependencies.length) return;
    for (const dependency of dependencies) {
      this.updateList.get(dependency).push(callback);
    }
  }
  static getDependencies(callback) {
    const result = callback();
    const dependencies = [...this.listener];
    this.listener = [];
    return [result, dependencies];
  }
  static subScribe(callback, updateFunc) {
    const [result, dependencies] = Global.getDependencies(callback);
    Global.addEffect(updateFunc, dependencies);
    return result;
  }
}

class Util {
  static createTextNode(text) {
    return {
      node: null,
      create() {
        this.node = document.createTextNode(text);
      },
      mount(target, anchor) {
        target.insertBefore(this.node, anchor || null);
      },
      update(value) {
        this.node.textContent = value;
      },
      delete() {
        this.node.parentNode.removeChild(this.node);
      },
    };
  }
  static createNode(children) {
    return {
      condition: true,
      create() {
        Util.handleCreateChildren(children);
      },
      mount(target, anchor) {
        if (this.condition) for (const el of children) el.mount(target, anchor);
      },
      delete() {
        for (const el of children) el.delete();
      },
    };
  }
  static handleAttributes(tag, attributes, destroy) {
    for (let prop in attributes) {
      switch (true) {
        case /ref/.test(prop): {
          const value = attributes[prop]();
          value.current = tag;
          break;
        }
        case /^on/.test(prop): {
          const eventName = prop.slice(2).toLowerCase();
          const event = attributes[prop];
          console.table("onclick", eventName, event());
          tag.addEventListener(eventName, event());
          destroy.push(() => tag.removeEventListener(eventName, event()));
          break;
        }
        case /^bind:/.test(prop): {
          const value = attributes[prop];
          const propName = prop.slice(5);
          tag.addEventListener("input", ({ target }) =>
            value(target[propName])
          );
          Global.subScribe(value, () => (tag[propName] = value()));
        }
        case /key/.test(prop): {
          break;
        }
        case /className/.test(prop):
          prop = "class";
        default: {
          let value = attributes[prop];
          if (typeof value === "function") {
            value = Global.subScribe(value, () =>
              tag.setAttribute(prop, value())
            );
          }
          tag.setAttribute(prop, value);
        }
      }
    }
  }
  static handleDynamicJSX(func) {
    let [result, dependencies] = Global.getDependencies(func);
    if (typeof result === "string" || typeof result === "number") {
      const textNode = Util.createTextNode(result);
      Global.addEffect(() => textNode.update(func()), dependencies);
      return textNode;
    }
    if (Array.isArray(result)) {
      const node = Util.createNode(result);
      if (!dependencies.length) return node;
      node.anchor = Util.createTextNode("");
      let array_block = new Map();
      for (const id in result) {
        const el = result[id];
        const key = el?.key ?? id;
        array_block.add(key, el);
      }
      const update = () => {
        const updated_array_block = new Map();
        result = func();
        for (const id in result) {
          let el = result[id];
          const key = el?.key ?? id;
          if (array_block.has(key)) {
            el = array_block.get(key);
          } else {
            el.create();
            el.mount(node.anchor.node.parentNode, node.anchor.node);
          }
          updated_array_block.add(key, el);
        }
        for (const key in array_block.keys()) {
          if (!updated_array_block.has(key)) array_block.get(key).delete();
        }
        array_block = updated_array_block;
      };
      Global.addEffect(update, dependencies);
      return node;
    }
    throw new Error(`Unknown type of input (${result})`);
  }
  static handleCreateChildren(children = []) {
    const len = children.length;
    for (const id in children) {
      const child = children[id];
      switch (typeof child) {
        case "object": {
          child?.anchor?.create();
          child.create();
          break;
        }
        case "undefined":
          break;
        case "string":
        case "number": {
          children[id] = Util.createTextNode(child);
          children[id].create();
          break;
        }
        case "function": {
          children[id] = Util.handleDynamicJSX(child);
          children[id]?.anchor?.create();
          children[id].create();
          break;
        }
        default: {
          throw new Error(`Unknow type of input (${child})`);
        }
      }
    }
  }
  static createHTMLElement(name, attributes, ...children) {
    const destroy = [];
    const onUnmount = [];
    let tag;
    return {
      key: attributes?.key?.(),
      create() {
        tag = document.createElement(name);
        if (attributes) Util.handleAttributes(tag, attributes, destroy);
        Util.handleCreateChildren(children);
      },
      mount(target, anchor) {
        for (const el of children) {
          el.mount(tag);
          el?.anchor?.mount(tag);
        }
        target.insertBefore(tag, anchor || null);
        if (this.onMount)
          for (const callback of this.onMount) {
            const unMountFunc = callback();
            if (unMountFunc) onUnmount.push(unMountFunc);
          }
      },
      delete() {
        for (const fn of destroy) fn();
        node.parentNode.removeChild(node);
        for (const callback of onUnmount) callback();
      },
    };
  }
}

class React {
  static Fragment = Symbol();
  static createElement(tagName, attributes, ...children) {
    if (tagName === React.Fragment) return Util.createNode(children);
    if (typeof tagName === "function") {
      const node = tagName({ children, ...attributes });
      const list = Global.onMount.flush();
      if (list.length) node.onMount = list;
      return node;
    }
    return Util.createHTMLElement(tagName, attributes, ...children);
  }
  static mount(root, target) {
    if (!target) throw new Error(`target element is Undefined`);
    if (typeof root === "function") {
      root = root();
      const onMount = Global.onMount.flush();
      if (onMount.length) root.onMount = onMount;
      root?.create();
      root?.mount(target);
    } else target.append(root);
    Global.isMounted = false;
  }
}
export const useState = (data) => {
  const state = new Store(data);
  return (newVal) => {
    if (!newVal) return state.val;
    if (typeof newVal === "function") {
      state.val = newVal(state.val);
    } else state.val = newVal;
  };
};

export const onMount = (data) => {
  Global.onMount.add(data);
};

export const If = (prop) => {
  if (!prop.condition) throw new Error(`condition attribute missing in If`);
  const node = Util.createNode(prop.children);
  node.anchor = Util.createTextNode("");
  node.condition = Global.subScribe(prop.condition, () => {
    const newVal = prop.condition();
    if (node.condition === newVal) return;
    node.condition = newVal;
    if (newVal) {
      node.mount(node.anchor.node.parentNode, node.anchor.node);
    } else node.delete();
  });
  return node;
};

export default React;
