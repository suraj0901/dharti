# reactive
## Easy, lighwight and fast library for build UI interface
## Close to React or Preact or Solid 
## it require @vitejs/reactive-plugin 

Counter.jsx
```js
import { useState, If } from "reactive";
import Button from "./Button";
const Counter = () => {
  const count = useState(0);
  return (
    <div>
      <If condition={count() > 10}> Hello world </If>
      <h1>{count()} </h1>
      <Button onClick={() => count((prev) => ++prev)}>increment</Button>
      <Button onClick={() => count((prev) => --prev)}>decrement</Button>
      <br />
      <input
        type="number"
        onInput={({ target }) => count(parseInt(target.value))}
      />
    </div>
  );
};

export default Counter;
```

Button.jsx
```js
const Button = ({ children, onClick }) => {
  return <button onClick={onClick()}>{children}</button>;
};

export default Button;

```
main.js
```js
import Counter from "./src/counter";
import React from "reactive";

Reactive.mount(Counter, document.getElementById("app"));
```
