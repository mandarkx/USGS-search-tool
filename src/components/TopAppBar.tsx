import React, { useState, MouseEvent } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AdbIcon from '@mui/icons-material/Adb';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export default function TopAppBar() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <AppBar position="static" color="primary">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="logo"
        >
          <AdbIcon />
        </IconButton>

        <div>
          <Button
            color="inherit"
            id="dropdown-button"
            aria-controls={open ? 'dropdown-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleClick}
            endIcon={<KeyboardArrowDownIcon />}
          >
            Actions
          </Button>
          
          <Menu
            id="dropdown-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
              'aria-labelledby': 'dropdown-button',
            }}
          >
            <MenuItem onClick={handleClose}>Option A</MenuItem>
            <MenuItem onClick={handleClose}>Option B</MenuItem>
            <MenuItem onClick={handleClose}>Option C</MenuItem>
          </Menu>
        </div>
      </Toolbar>
    </AppBar>
  );
}