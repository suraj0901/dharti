# dharti

- Easy, lighwight and fast library for build UI interface
- Close to React or Preact or Solid .....
- No Virtual DOM
- Default state managment is enough don't require any external library
- it require @vitejs/dharti-plugin

Counter.jsx

```js
import { useState, If, Else, ElseIf, useEffect } from "dharti";
import Button from "./Button";
const Counter = () => {
  const count = useState(0);
  const show = useState(false);
  useEffect(() => console.log(count()));
  return (
    <>
      <If condition={count() >= 50}>
        <p>Count is dangerously high {count()}</p>
        <ElseIf condition={count() > 10 && count() < 50}>
          <p>Count is bit higher {count()}</p>
        </ElseIf>
        <Else>
          <h1>{count()} </h1>
        </Else>
      </If>
      <div>
        <input type="checkbox" bind:checked={show} />
        <label>Show Increment and Decrement buttons</label>
      </div>
      <If condition={show()}>
        <Button onClick={() => count((prev) => ++prev)}>increment</Button>
        <Button onClick={() => count((prev) => --prev)}>decrement</Button>
      </If>
      <br />
      <input type="number" bind:value={count} />
    </>
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
import Dharti from "dharti";

Dharti.mount(Counter, document.getElementById("app"));
```
