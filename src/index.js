
const lifecycleEvents = [
    'onMount',
    'onUnmount',
    'onUpdate'
]

const createNode = (name, props, children, text, lifecycles, key, isGhost) => ({
    name,
    props,
    children,
    text,
    lifecycles,
    key,
    isGhost
})

const eventProxy = (event) => {
    event.currentTarget.events[event.type](event)
}

var transformStyle = style => {
    let inlineStyle = ''
    for (const propKey in style) {
        inlineStyle += `${propKey.replace(/([A-Z])/g, '-$1').toLocaleLowerCase()}:${style[propKey]};`
    }
    return inlineStyle
}

const areNodeEquals = (node1, node2) => {
    const props1 = node1.props
    const props2 = node2.props
    if (node1.children !== node2.children) return false;
    for (const key in props1) {
        if (props1[key] !== props2[key]) return false;
    }
    for (const key in props2) {
        if (props1[key] !== props2[key]) return false;
    }
    return true
}

const applyAttribute = (element, attributeName, attribute) => {
    if (attributeName === 'children') {
        return;
    }
    if (attributeName.indexOf('on') === 0) {
        const eventType = attributeName.slice(2).toLowerCase()
        element.events[eventType] = attribute
        element.addEventListener(eventType, eventProxy)
    } else if (attributeName === 'className') {
        element.setAttribute('class', attribute)
    } else if (attributeName === 'style' && typeof attribute === 'object') {
        element.setAttribute('style', transformStyle(attribute))
    } else if (attributeName !== 'key') {
        element.setAttribute(attributeName, attribute)
    }
}

var createElement = (node) => {
    var element = node.text !== null
        ? document.createTextNode(node.text)
        : document.createElement(node.name)

    const { props } = node
    element.events = {}

    for (var propKey in props) {
        applyAttribute(element, propKey, props[propKey])
    }

    return element
}

var renderNode = (node, container, nextElement) => {
    if (node.isGhost) {
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i]) {
                renderNode(node.children[i], container, nextElement)
            }
        }
        return
    } else if (typeof node.name === 'function') {
        if (node.lifecycles.onMount) {
            node.lifecycles.onMount(node.props)
        }
        return node._ref = renderNode(node.children[0], container, nextElement)
    } else {
        const children = node.children
        const element = createElement(node)
        node._ref = element

        if (children) {
            for (let i = 0; i < children.length; i++) {
                if (children[i]) {
                    renderNode(children[i], element)
                }
            }
        }
        if (nextElement) {
            container.insertBefore(element, nextElement)
        } else {
            container.appendChild(element)
        }

        return element
    }
}

const removeChildren = (node) => {
    if (node.lifecycles) {
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i]) {
                removeChildren(node.children[i])
            }
        }

        if (node.lifecycles.onUnmount) {
            node.lifecycles.onUnmount()
        }
    }
}

const patchChildrenNode = (lastNode, nextNode, element, previousElement) => {
    const lastChildren = lastNode.children
    const nextChildren = nextNode.children
    const lastKeys = {}
    const nextKeys = {}
    let shouldReorder = false
    for (let i = 0; i < nextChildren.length; i++) {
        const nextChild = nextChildren[i]
        nextKeys[nextChild.key] = nextChild
    }
    let lastChildElement = previousElement
    for (let i = lastChildren.length - 1; i > -1; i--) {
        const lastChild = lastChildren[i]
        const nextChild = nextKeys[lastChild.key]
        if (nextChildren[i] && lastChild.key !== nextChildren[i].key) {
            shouldReorder = true
        }
        if (lastChild._ref) {
            if (nextChild && !nextChild.isGhost) {
                lastKeys[lastChild.key] = lastChild
                patchNode(lastChild, nextChild)
                lastChildElement = lastChild._ref
            } else {
                removeChildren(lastChild)
                const parent = lastNode._ref || element
                parent.removeChild(lastChild._ref)
            }
        } else if (nextChild && nextChild.isGhost) {
            lastKeys[lastChild.key] = lastChild
            lastChildElement = patchChildrenNode(lastChild, nextChild, element, lastChildElement)
        }
    }
    lastChildElement = null

    if (shouldReorder) {
        for (let i = nextChildren.length - 1; i > - 1; i--) {
            const lastChild = lastKeys[nextChildren[i].key]
            if (lastChild) {
                if (lastChildElement) {
                    element.insertBefore(lastChild._ref, lastChildElement)
                    lastChildElement = lastChild._ref
                } else {
                    previousElement
                        ? element.insertBefore(lastChild._ref, previousElement)
                        : element.appendChild(lastChild._ref)
                    lastChildElement = lastChild._ref
                }
            }
        }
    }

    lastChildElement = null
    for (let i = nextChildren.length - 1; i > -1; i--) {
        const nextChild = nextChildren[i]
        const lastChild = lastKeys[nextChild.key]
        if (lastChild) {
            if (lastChild._ref) {
                lastChildElement = lastChild._ref
            } else if (lastChild.isGhost) {
                if (lastChild.children.length > 0) {
                    lastChildElement = lastChild.children[0]._ref
                }
            }
        } else if (!nextChild.isGhost) {
            lastChildElement = i !== nextChildren.length - 1 && lastChildElement
                ? renderNode(nextChild, element, lastChildElement)
                : renderNode(nextChild, element, previousElement)
        }
    }
    return lastChildElement
}
const patchNode = (lastNode, nextNode) => {
    nextNode._ref = lastNode._ref

    if (typeof nextNode.name === 'function') {
        if (areNodeEquals(lastNode, nextNode)) {
            return lastNode
        }
        patchNode(lastNode.children[0], nextNode.children[0])
    } else {
        const element = lastNode._ref
        if (nextNode.text !== null) {
            element.textContent = nextNode.text
            return
        }
        for (const propKey in nextNode.props) {
            const nextProp = nextNode.props[propKey]
            if (lastNode.props[propKey] === nextProp) {
                continue
            }
            applyAttribute(element, propKey, nextProp)
        }
        patchChildrenNode(lastNode, nextNode, lastNode._ref, null)
    }
    if (lastNode.lifecycles.onUpdate) {
        lastNode.lifecycles.onUpdate(lastNode.props, nextNode.props)
    }

    return nextNode
}

export var render = (node, container) => {
    renderNode(node, container)
}

const getProperChild = (child, index) => {
    if (child === null || child === undefined || child === false || child === true || child === '') {
        return createNode(null, {}, [], null, {}, index, true)
    }
    if (child instanceof Array) {
        return createNode(null, {}, child, null, {}, index, true)
    }
    if (typeof child === 'object') {
        return { ...child, key: child.key || index }
    }
    return createNode(null, {}, [], "" + child, {}, index)
}

export const applyProps = (node, props) => {
    for (const propKey in props) {
        node.props[propKey] = props[propKey]
    }
    return node
}

export default (name, props, ...children) => {
    props = props || {}
    const finalProps = {}
    const lifecycles = {}
    for (let propKey in props) {
        if (lifecycleEvents.indexOf(propKey) !== -1) {
            lifecycles[propKey] = props[propKey]
        } else if (propKey !== 'key') {
            finalProps[propKey] = props[propKey]
        }
    }
    let node;
    if (typeof name === 'function') {
        const update = function (nextNode) {
            node.props = nextNode.props
            node.children[0] = patchNode(node.children[0], nextNode)
        }
        const propChild = children[0] || finalProps.children
        const childProps = propChild
            ? { ...finalProps, children: propChild }
            : finalProps
        const child = name(childProps, update)
        children = [child]
    }

    for (let i = 0; i < children.length; i++) {
        if (children[i] instanceof Array) {
            const subChildren = []
            for (let j = 0; j < children[i].length; j++) {
                subChildren.push(getProperChild(children[i][j], j))
            }
            children[i] = getProperChild(subChildren, i)
        } else {
            children[i] = getProperChild(children[i], i)
        }
    }

    return node = createNode(name, finalProps, children, null, lifecycles, props.key)
}
