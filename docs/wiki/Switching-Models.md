# Switching models

Changing model in place resends the whole conversation to a cold cache. baton avoids that:

```
/baton:switch      # old model writes the brief while its cache is warm
/clear
/model opus
/baton:takeover <name>
```

The new model reads a few thousand tokens. baton cannot intercept `/model`; switching in place still resends everything.
