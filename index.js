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
        this?.anchor?.create();
      },
      mount(target, anchor) {
        for (const el of children) {
          el.mount(target, anchor);
          el?.anchor?.mount(target, anchor);
        }
      },
      delete() {
        for (const el of children) {
          el.delete();
          el?.anchor?.delete();
        }
      },
    };
  }
  static handleAttributes(tag, attributes, destroy) {
    for (let prop in attributes) {
      switch (true) {
        case /key|show|hide/.test(prop): {
          break;
        }
        case /ref/.test(prop): {
          attributes[prop]()(tag);
          break;
        }
        case /^on/.test(prop): {
          const eventName = prop.slice(2).toLowerCase();
          const event = attributes[prop];
          tag.addEventListener(eventName, event());
          destroy.push(() => tag.removeEventListener(eventName, event()));
          break;
        }
        case /^bind:/.test(prop): {
          const value = prop.slice(5);
          const callback = attributes[prop]();
          const event =
            tag.type === "number" || tag.type === "text" ? "input" : "change";
          const fn = ({ target }) => callback(target[value]);
          tag.addEventListener(event, fn);
          destroy.push(() => tag.removeEventListener(event, fn));
          Global.subScribe(callback, () => (tag[value] = callback()));
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
            el?.anchor?.create();
            el.mount(node.anchor.node.parentNode, node.anchor.node);
            el?.anchor?.mount(node.anchor.node.parentNode, node.anchor.node);
          }
          updated_array_block.add(key, el);
        }
        for (const key in array_block.keys()) {
          if (!updated_array_block.has(key)) {
            const el = array_block.get(key);
            el.delete();
            el?.anchor?.delete();
          }
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
    const node = {
      key: attributes?.key?.(),
      mounted: false,
      create() {
        tag = document.createElement(name);
        if (attributes) Util.handleAttributes(tag, attributes, destroy);
        Util.handleCreateChildren(children);
        this?.anchor?.create();
      },
      mount(target, anchor) {
        if (this.mounted) return;
        if (this?.shouldNotMount) return;
        for (const el of children) {
          el.mount(tag);
          el?.anchor?.mount(tag);
        }
        target.insertBefore(tag, anchor || null);
        this.mounted = true;
        if (this.onMount)
          for (const callback of this.onMount) {
            const unMountFunc = callback();
            if (unMountFunc) onUnmount.push(unMountFunc);
          }
      },
      delete() {
        if (!this.mounted) return;
        for (const fn of destroy) fn();
        for (const el of children) {
          el.delete();
          el?.anchor?.delete();
        }
        tag.parentNode.removeChild(tag);
        this.mounted = false;
        for (const callback of onUnmount) callback();
      },
    };
    if (attributes?.show || attributes?.hide) {
      node.anchor = Util.createTextNode("");
      node.shouldNotMount = Global.subScribe(
        () => attributes?.hide?.() ?? !attributes?.show?.(),
        () => {
          if (
            (node.shouldNotMount =
              attributes?.hide?.() ?? !attributes?.show?.())
          )
            node.delete();
          else node.mount(node.anchor.node.parentNode, node.anchor.node);
        }
      );
    }
    return node;
  }
}

class React {
  static Fragment = Symbol();
  static If = Symbol();
  static Else = Symbol();
  static ElseIf = Symbol();
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
      root?.anchor?.mount(target);
      root?.mount(target);
    } else target.append(root);
    Global.isMounted = false;
  }
}
export const useEffect = (func) => {
  Global.subScribe(func, func);
};
export const useState = (data) => {
  const state = new Store(data);
  return (newVal) => {
    if (newVal === undefined) return state.val;
    if (typeof newVal === "function") {
      state.val = newVal(state.val);
    } else state.val = newVal;
    return state.val;
  };
};

export const onMount = (data) => {
  Global.onMount.add(data);
};

export const If = (prop) => {
  if (!prop.condition) throw new Error(`condition attribute missing in If`);
  const node = {
    type: React.If,
    anchor: Util.createTextNode(""),
    body: [],
    currentNode: null,
    create() {
      for (const el of this.body) el.create();
      this?.else?.create();
      this.anchor.create();
    },
    mount(target, anchor) {
      Global.subScribe(
        () => {
          this.currentNode = node?.else;
          for (const el of this.body) {
            if (el.condition()) this.currentNode = el;
          }
        },
        () => {
          let el = node?.else;
          for (const child of this.body) if (child.condition()) el = child;
          if (el) {
            if (el === this.currentNode) return;
            this.currentNode?.delete();
            this.currentNode?.anchor?.delete();
            el.mount(this.anchor.node.parentNode, this.anchor.node);
            el?.anchor?.mount(this.anchor.node.parentNode, this.anchor.node);
            this.currentNode = el;
          } else {
            this.currentNode?.delete();
            this.currentNode?.anchor?.delete();
            this.currentNode = null;
          }
        }
      );
      this.currentNode?.mount(target, anchor);
      this.anchor.mount(target, anchor);
    },
    delete() {
      for (const el of this.body) el.delete();
    },
  };
  const ifBody = [];
  for (const child of prop.children) {
    switch (child?.type) {
      case React.Else: {
        node.else = child;
        break;
      }
      case React.ElseIf: {
        node.body.push(child);
        break;
      }
      default:
        ifBody.push(child);
    }
  }
  node.body.unshift(ElseIf({ children: ifBody, condition: prop.condition }));
  return node;
};

export const Else = (prop) => {
  const node = Util.createNode(prop.children);
  node.type = React.Else;
  return node;
};
export const ElseIf = (prop) => {
  if (!prop.condition) throw new Error(`condition attribute missing in ElseIf`);
  const node = Util.createNode(prop.children);
  node.type = React.ElseIf;
  node.condition = prop.condition;
  return node;
};
export default React;
