
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

const transformStyle = style => {
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

const createElement = (node) => {
    const element = node.text !== null
        ? document.createTextNode(node.text)
        : document.createElement(node.name)

    const { props } = node
    element.events = {}

    for (const propKey in props) {
        applyAttribute(element, propKey, props[propKey])
    }

    return element
}

const renderNode = (node, container, nextElement) => {
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
    for (let i = 0; i < node.children.length; i++) {
        if (node.children[i]) {
            removeChildren(node.children[i])
        }
    }

    if (node.lifecycles.onUnmount) {
        node.lifecycles.onUnmount()
    }
}

const patchChildrenNode = (lastNode, nextNode, element, previousElement) => {
    const lastChildren = lastNode.children
    const nextChildren = nextNode.children
    const lastKeys = {}
    const nextKeys = {}
    let shouldReorder = false
    for (let i = 0; i < lastChildren.length; i++) {
        const lastChild = lastChildren[i]
        lastKeys[lastChild.key] = lastChild
    }

    let lastChildElement = previousElement
    for (let i = nextChildren.length - 1; i > -1; i--) {
        const nextChild = nextChildren[i]
        const lastChild = lastKeys[nextChild.key]
        const { isGhost } = nextChild

        if (lastChildren[i] && nextChild.key !== lastChildren[i].key) {
            shouldReorder = true
        }
        if (lastChild && lastChild._ref) {
            if (!isGhost) {
                nextKeys[nextChild.key] = nextChild
                patchNode(lastChild, nextChild)
            }
            if (shouldReorder) {
                if (lastChildElement) {
                    element.insertBefore(lastChild._ref, lastChildElement)
                } else if (previousElement) {
                    element.insertBefore(lastChild._ref, previousElement)
                } else {
                    element.appendChild(lastChild._ref)
                }
            }
            if (!isGhost) {
                lastChildElement = lastChild._ref
            }
        } else if (!isGhost) {
            nextKeys[nextChild.key] = nextChild
            lastChildElement = i !== nextChildren.length - 1 && lastChildElement
                ? renderNode(nextChild, element, lastChildElement)
                : renderNode(nextChild, element, previousElement)
        } else {
            nextKeys[nextChild.key] = nextChild
            lastChildElement = patchChildrenNode(lastChild, nextChild, element, lastChildElement)
        }
    }

    for (let i = 0; i < lastChildren.length; i++) {
        const lastChild = lastChildren[i]
        if (!nextKeys[lastChild.key] && !lastChild.isGhost) {
            removeChildren(lastChild)
            const parent = lastNode._ref || element
            parent.removeChild(lastChild._ref)
        }
    }
    return lastChildElement
}
const patchNode = (lastNode, nextNode) => {
    nextNode._ref = lastNode._ref
    if (typeof nextNode.name === 'function') {
        if (areNodeEquals(lastNode, nextNode)) {
            return;
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
    for (const propKey in nextNode) {
        lastNode[propKey] = nextNode[propKey]
    }
}

export const render = (node, container) => {
    renderNode(node, container)
}

const getProperChild = (child, index) => {
    if (child === null || child === undefined || child === false || child === '' || child === true ) {
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

export default (name, props, ...children) => {
    props = props || {}
    const finalProps = {}
    const lifecycles = {}
    for (const propKey in props) {
        if (lifecycleEvents.indexOf(propKey) !== -1) {
            lifecycles[propKey] = props[propKey]
        } else if (propKey !== 'key') {
            finalProps[propKey] = props[propKey]
        }
    }

    if (typeof name === 'function') {
        const propChild = children[0] || finalProps.children
        const childProps = propChild
            ? { ...finalProps, children: propChild }
            : finalProps
        const child = name(childProps, (lastNode, nextNode) => {
            patchNode(lastNode, nextNode)
            return lastNode
        })
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

    return createNode(name, finalProps, children, null, lifecycles, props.key)
}
