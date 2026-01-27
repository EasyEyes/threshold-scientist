# 2025-01-27: User Class Prototype Loss in setState

## Problem

`user.initProjectList()` becomes `undefined` after `setState`.

## Cause

```javascript
this.setState({
  user: { ...this.state.user, projectList: newList }, // ❌ Loses prototype
});
```

Spread operator creates plain `Object`, copying only enumerable properties. Class methods from prototype chain are lost.

## Fix

```javascript
const updatedUser = this.state.user;
updatedUser.projectList = newList;
this.setState({ user: updatedUser }); // ✅ Preserves prototype
```

Mutate the reference directly, then pass same instance to setState.

## Files

- `source/App.js`: handleSetProjectList, handleSetExperiment, handleGetNewRepo
