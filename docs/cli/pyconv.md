# pxt-pyconv Manual Page

### @description Converts from MicroPython to PXT

Convert a MicroPython module(s) to PXT

```
pxt pyconv <directory> [<support directory>...]
```

## Operation

All modules found in `<directory>` will be converted and written out in current directory.

Additional Python modules will be searched for in the support directories. They are converted
in background, but the results are not written.

The command requires `python3` executable to be in the `PATH`.

## Limitations

Only a small fragment of Python is supported. The output is meant to be a starting
point for a PXT module.

* `__getitem__`, `__setitem__` (indexers) are not supported
* scopes of variables can get confused - you might need to pull out variables by hand

`try`/`catch` is converted by not supported by PXT yet.

## See Also

[pxt](/cli) tool
