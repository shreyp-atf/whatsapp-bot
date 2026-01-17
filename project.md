This is a whatsapp bot, which a user can talk to through whatsapp. The purpose is to help the user have a better and more active social life.

The whatsapp integration is done through Periskope.

Periskope documentaion can be found here
API - https://docs.periskope.app/api-reference/introduction
Webhooks - https://docs.periskope.app/api-reference/webhooks/introduction

We want to implement all the functionality in this documentation, especially subscribe to all the webhook events listed in the webhooks subdomain.

We also have a supporting database in @db_schema

The flow look like this -
1. A user sends Hi on whatsapp. A chat.created webhook event is fired. If the chat_id ends in @c.us, it is a 1:1 chat, and we should initialize a profile for the user.

A user is essentially just a contact number for now.