# reactive

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
