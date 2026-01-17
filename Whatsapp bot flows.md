Whatsapp bot flows

New Conversation:
1. User initiates a conversation with the bot
2. Bot initiates user onboarding.

User Onboarding:
1. We need the following information from the user:
   - Name
   - City
   - Country
   - Date of birth
   - Gender
   - Interests
   - Goals
   - Pain points

Engage the user in a conversation to get all these and any other information that we can get. Add this information to the user persona in the user table.

After the user onboarding, the bot should be able to:
Answer questions about what the user will say yes to or not to a given activity.

Purpose of a conversation:
User will primarily ask the bot what can they do on a given day. Could be today, tomorrow or whenever.

Bot's response:
1. If the user has no activities planned for the day, the bot should suggest activities that the user can do.
2. If the user has some activities planned, the bot should suggest what the user can do after this activity.

If the user says no to an activity, the bot should suggest an alternative activity that the user can do.
If the user says yes to an activity, the bot should suggest what the user can do after this activity.

The bot should not present more than 3 things to do to the user on any given day.

Whenever a user says no to an activity, the bot should update that in the database.

The bot should ask the user questions when it doesn't know the answer. The bot should also aim to get to know the user better whenever the user says opposite of what the bot expects.

