
const lifecycleEvents = [
    'onMount',
    'onUnmount',
    'onUpdate'
]

var createNode = (name, props, children, text, lifecycles, key) => ({
    name,
    props,
    children,
    text,
    lifecycles,
    key
})

var eventProxy = (event) => {
    event.currentTarget.events[event.type](event)
}

var transformStyle = style => {
    let inlineStyle = ''
    for (const propKey in style) {
        inlineStyle += `${propKey.replace(/([A-Z])/g, '-$1')}:${style[propKey]};`
    }
    return inlineStyle.toLowerCase()
}

var createElement = (node) => {
    var element = node.text !== null
        ? document.createTextNode(node.text)
        : document.createElement(node.name)

    var {
        props
    } = node

    if (!props) return element

    element.events = {}

    for (var propKey in props) {

        const prop = props[propKey]
        if (propKey === 'children') {
            continue;
        }

        if (propKey.indexOf('on') === 0) {
            const eventType = propKey.slice(2).toLowerCase()
            element.events[eventType] = prop
            element.addEventListener(eventType, eventProxy)
        } else if (propKey === 'className') {
            element.setAttribute('class', prop)
        } else if (propKey === 'style' && typeof prop === 'object') {
            element.setAttribute('style', transformStyle(prop))
        } else if (propKey !== 'key')  {
            element.setAttribute(propKey, prop)
        }

    }

    return element
}

var renderNode = (node, container, referenceNode) => {
    if (node.name === null && node.text === null) {

        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i]) {
                renderNode(node.children[i], container, referenceNode)
            }
        }

        return;
    }
    if (typeof node.name === 'function') {
        if (typeof node.children[0].name === 'function') {
            node.children[0].props = node.props
        }
        const _fiber = renderNode(node.children[0], container, referenceNode)
        node._fiber = _fiber
        return _fiber
    }
    var {
        children
    } = node

    var element = createElement(node)
    node._fiber = element

    if (children) {
        for (let i = 0; i < children.length; i++) {
            if (children[i]) {
                renderNode(children[i], element)
            }
        }
    }
    if (referenceNode) {
        container.insertBefore(element, referenceNode)
    } else {
        container.appendChild(element)
    }
    if (node.lifecycles.onMount) {
        node.lifecycles.onMount()
    }

    return element
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
        if (nextChild) {
            nextKeys[nextChild.key] = nextChild
        }
    }
    let lastChildElement = previousElement
    for (let i = lastChildren.length - 1; i > -1; i--) {
        const lastChild = lastChildren[i]
        const nextChild = nextKeys[lastChild.key]
        if (!nextChildren[i] || lastChild.key !== nextChildren[i].key) {
            shouldReorder = true
        }
        // existant
        if (lastChild._fiber) {
            if (nextChild && (nextChild.name || nextChild.text !== null)) {
                lastKeys[lastChild.key] = lastChild
                lastChildElement = lastChild._fiber
            } else {
                removeChildren(lastChild)
                const parent = lastNode._fiber || element
                parent.removeChild(lastChild._fiber)
            }
        } else if (nextChild && nextChild.name === null && nextChild.text === null) {
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
                    element.insertBefore(lastChild._fiber, lastChildElement)
                    lastChildElement = lastChild._fiber
                } else {
                    previousElement
                        ? element.insertBefore(lastChild._fiber, previousElement)
                        : element.appendChild(lastChild._fiber)
                    lastChildElement = lastChild._fiber
                }
            }
        }
    }

    lastChildElement = null
    for (let i = nextChildren.length - 1; i > -1; i--) {
        const nextChild = nextChildren[i]
        const lastChild = lastKeys[nextChild.key]
        if (lastChild) {
            if (lastChild._fiber) {
                lastChildElement = lastChild._fiber
            } else if (lastChild.name === null && lastChild.text === null) {
                if (lastChild.children.length > 0) {
                    lastChildElement = lastChild.children[0]._fiber
                }
            }
        } else if (nextChild.name || nextChild.text !== null) {
            lastChildElement = i !== nextChildren.length - 1 && lastChildElement
                ? renderNode(nextChild, element, lastChildElement)
                : renderNode(nextChild, element, previousElement)
        }
    }
    return lastChildElement
}
const patchNode = (lastNode, nextNode) => {
    nextNode._fiber = lastNode._fiber

    if (typeof nextNode.name === 'function') {
        if (lastNode.props && nextNode.props) {
            let shouldUpdate = false
            for (const lastPropKey in lastNode.props) {
                if (nextNode.props[lastPropKey] !== lastNode.props[lastPropKey]) {
                    shouldUpdate = true
                }
            }
            for (const nextPropKey in nextNode.props) {
                if (nextNode.props[nextPropKey] !== lastNode.props[nextPropKey]) {
                    shouldUpdate = true
                }
            }
            if (!shouldUpdate && lastNode.children === nextNode.children) {
                return lastNode
            }
        }
        patchNode(lastNode.children[0], nextNode.children[0])
    } else {
        const element = lastNode._fiber
        if (nextNode.text !== null) {
            element.textContent = nextNode.text
            return
        }
        for (const propKey in nextNode.props) {
            const prop = nextNode.props[propKey]
            if (propKey.indexOf('on') === 0) {
                continue
            }
            if (propKey === 'style' && typeof prop === 'object') {
                element.setAttribute('style', transformStyle(prop))
            } else if (propKey === 'className') {
                element.setAttribute('class', prop)
            } else if (propKey !== 'key') {
                element.setAttribute(propKey, prop)
            }
        }
        patchChildrenNode(lastNode, nextNode, lastNode._fiber, null)
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
        return createNode(null, null, [], null, {}, index)
    }
    if (child instanceof Array) {
        return createNode(null, null, child, null, {}, index)
    }
    if (typeof child === 'object') {
        return { ...child, key: child.key || index }
    }
    return createNode(null, null, [], "" + child, {}, index)
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
        const child = name(
            { ...finalProps, children: children[0] || finalProps.children },
            update
        )
        children = [child]
    }
    const finalChildren = []
    for (let i = 0; i < children.length; i++) {
        if (children[i] instanceof Array) {
            const subChildren = []
            for (let j = 0; j < children[i].length; j++) {
                subChildren.push(getProperChild(children[i][j], j))
            }
            finalChildren.push(getProperChild(subChildren, i))
        } else {
            finalChildren.push(getProperChild(children[i], i))
        }
    }

    return node = createNode(name, finalProps, finalChildren, null, lifecycles, props.key)
}
