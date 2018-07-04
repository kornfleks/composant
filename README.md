# Composant

Functionnal React-like.

TO-DO:

 - finish API
 - ~~change `_fiber` to `_ref`~~
 - add examples
 - add tests
 - add boilerplate (with JSX support) on another repo
 - ~~rewrite `patchNode` algorithm in order to optimized it~~
 - benchmarking


## Usages

### `initial render`

```jsx
import Composant, { render } from 'composant'

const App = (props) => (
  <div>
    Hello {props.name}!!
  </div>
)

render(<App name="world" />, document.querySelector('#app'))
```

### `lifecycle events`
Lifecycle events are props that can be implemented only on component.

```jsx
import Composant from 'composant'

const Header = (props) => (
  <header>
    <h3>{props.title}</h3>
  </header>
)

const App = (props) => (
  <div>
    <Header
      onMount={initialProps => console.log('initialProps:', initialProps)}
      onUpdate={(lastProps, nextProps) => console.log(lastProps, nextProps)}
      onUnmount={finalProps => console.log('finalProps:', initialProps)}
    />
    Hello {props.name}!!
  </div>
)

...
```

To avoid declaring lifecycle events in the parent rendering an `HOC` can wrap your component.

```jsx
import Composant from 'composant'

const withLifecycles = lifecycles => ComponentToWrap => props => (
  <ComponenToWrap
    {...lifecycles}
    {...props}
  />
)

const Header = (props) => (
  <header>
    <h3>{props.title}</h3>
  </header>
)

const HeaderWithLifecycles = withLifecycles({
  onMount: initialProps => console.log('initialProps:', initialProps),
  onUpdate: (lastProps, nextProps) => console.log(lastProps, nextProps),
  onUnmount: finalProps => console.log('finalProps:', initialProps)
})(Header)

const App = (props) => (
  <div>
    <HeaderWithLifecycles />
    Hello {props.name}!!
  </div>
)

...
```


## JSX

JSX is an XML-like syntax extension to ECMAScript without any defined semantics.
To implement `JSX` to your project the `babel` plugin `transform-react-jsx` have to be configured with the `pragma` property set to `Composant`

Example:
```js
"plugins": [
  [
    "transform-react-jsx",
    {
      "pragma": "Composant"
    }
  ]
]
```