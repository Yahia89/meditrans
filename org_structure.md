owner stays the same: full previlige.

admin: can do everything except delete owner and change organization name.

dispatch: can view drivers, patients only. can create trips and assign them to drivers (the whole bit).

driver: can view assigned trips.

one major thing: people/users get invtes, and they can accept or reject them. if they accept, they become a user in the organization. if they reject, they don't.

currently i logged using an account that hasn't accept the invite, they can't see any data, that can see pages but nothing inside (like no data on the screen), so we need to guard that so it doesn't look like there's an error or something. instead, we should show a message that says "you haven't accepted the invite yet" or something like that. and also we need to add a button to accept the invite, and when they click it, it should accept the invite and redirect them to the dashboard.
